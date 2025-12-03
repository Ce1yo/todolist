// Import Firebase configuration
import { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from './firebase-config.js';

// Sélection des éléments du DOM
const taskInput = document.getElementById('taskInput');
const taskDescription = document.getElementById('taskDescription');
const taskPriority = document.getElementById('taskPriority');
const taskLink = document.getElementById('taskLink');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const taskCount = document.getElementById('taskCount');
const weekInfo = document.getElementById('weekInfo');
const historySection = document.getElementById('historySection');
const logsList = document.getElementById('logsList');
const emptyLogs = document.getElementById('emptyLogs');

// Tableau pour stocker les tâches et les logs
let tasks = [];
let logs = [];
let currentTab = 'current';
let currentFilter = 'all';

// Charger les tâches depuis Firestore au démarrage
document.addEventListener('DOMContentLoaded', async () => {
    updateWeekInfo();
    await checkAndCleanWeek();
    await loadTasks();
    await loadLogs();
    updateUI();
    setupTabListeners();
    setupFilterListeners();
    displayLogs();
});

// Événement pour ajouter une tâche
addTaskBtn.addEventListener('click', addTask);

// Ajouter une tâche avec la touche Entrée sur le champ titre
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addTask();
    }
});

// Fonction pour obtenir la semaine en cours
function updateWeekInfo() {
    const now = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const dateStr = now.toLocaleDateString('fr-FR', options);
    
    // Obtenir le lundi de la semaine en cours
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    
    const mondayStr = monday.toLocaleDateString('fr-FR', options);
    weekInfo.textContent = `Semaine du ${mondayStr}`;
}

// Fonction pour ajouter une tâche
async function addTask() {
    const taskText = taskInput.value.trim();
    const description = taskDescription.value.trim();
    const priority = taskPriority.value;
    const link = taskLink.value.trim();
    
    if (taskText === '') {
        taskInput.focus();
        return;
    }
    
    const task = {
        text: taskText,
        description: description || null,
        priority: priority,
        completionPercentage: 0,
        link: link || null,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    try {
        // Ajouter à Firestore
        const docRef = await addDoc(collection(db, 'tasks'), task);
        
        // Logger l'action
        await logAction('added', task.text, {
            description: task.description,
            link: task.link
        });
        
        // Réinitialiser les champs
        taskInput.value = '';
        taskDescription.value = '';
        taskPriority.value = 'medium';
        taskLink.value = '';
        taskInput.focus();
        
        // Recharger les tâches et logs
        await loadTasks();
        await loadLogs();
        updateUI();
    } catch (error) {
        console.error("Erreur lors de l'ajout de la tâche:", error);
        alert("Erreur lors de l'ajout de la tâche. Veuillez réessayer.");
    }
}

// Fonction pour supprimer une tâche
async function deleteTask(id) {
    try {
        const task = tasks.find(t => t.id === id);
        if (task) {
            // Logger l'action avant de supprimer
            await logAction('deleted', task.text, {
                description: task.description,
                link: task.link
            });
        }
        
        await deleteDoc(doc(db, 'tasks', id));
        await loadTasks();
        await loadLogs();
        updateUI();
    } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        alert("Erreur lors de la suppression de la tâche.");
    }
}

// Fonction pour basculer le statut d'une tâche (complétée ou non)
async function toggleTask(id) {
    const task = tasks.find(task => task.id === id);
    if (task) {
        try {
            const newStatus = !task.completed;
            const updateData = {
                completed: newStatus
            };
            
            // Si on marque comme complétée, passer la completion à 100%
            if (newStatus) {
                updateData.completionPercentage = 100;
            }
            
            await updateDoc(doc(db, 'tasks', id), updateData);
            
            // Logger l'action si la tâche est complétée
            if (newStatus) {
                await logAction('completed', task.text, {
                    description: task.description,
                    link: task.link
                });
            }
            
            await loadTasks();
            await loadLogs();
            updateUI();
        } catch (error) {
            console.error("Erreur lors de la mise à jour:", error);
        }
    }
}

// Fonction pour basculer le statut d'une étape
async function toggleStep(taskId, stepIndex) {
    const task = tasks.find(task => task.id === taskId);
    if (task && task.steps && task.steps[stepIndex]) {
        try {
            task.steps[stepIndex].completed = !task.steps[stepIndex].completed;
            await updateDoc(doc(db, 'tasks', taskId), {
                steps: task.steps
            });
            
            await loadTasks();
            updateUI();
        } catch (error) {
            console.error("Erreur lors de la mise à jour de l'étape:", error);
        }
    }
}

// Fonction pour mettre à jour la completion d'une tâche
async function updateTaskCompletion(id, percentage) {
    try {
        await updateDoc(doc(db, 'tasks', id), {
            completionPercentage: percentage
        });
        
        await loadTasks();
        updateUI();
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la completion:", error);
    }
}

// Fonction pour mettre à jour la priorité d'une tâche
async function updateTaskPriority(id, priority) {
    try {
        await updateDoc(doc(db, 'tasks', id), {
            priority: priority
        });
        
        await loadTasks();
        updateUI();
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la priorité:", error);
    }
}

// Fonction pour mettre à jour le lien d'une tâche
async function updateTaskLink(id, link) {
    try {
        await updateDoc(doc(db, 'tasks', id), {
            link: link
        });
        
        await loadTasks();
        updateUI();
    } catch (error) {
        console.error("Erreur lors de la mise à jour du lien:", error);
    }
}

// Fonction pour afficher/masquer les détails d'une tâche
function toggleExpand(event, id) {
    // Trouver l'élément task-item parent
    const taskItem = event.currentTarget.closest('.task-item');
    if (taskItem) {
        taskItem.classList.toggle('expanded');
    }
}

// Fonction pour mettre à jour l'interface utilisateur
function updateUI() {
    // Vider la liste actuelle
    taskList.innerHTML = '';
    
    // Afficher l'état vide si aucune tâche
    if (tasks.length === 0) {
        emptyState.classList.remove('hidden');
        taskCount.textContent = '0 tâche';
        return;
    }
    
    emptyState.classList.add('hidden');
    
    // Mettre à jour le compteur
    const count = tasks.length;
    taskCount.textContent = `${count} tâche${count > 1 ? 's' : ''}`;
    
    // Trier les tâches : non complétées en haut (par priorité), complétées en bas
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedTasks = [...tasks].sort((a, b) => {
        // D'abord, trier par statut (non complétées en haut)
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        // Ensuite, trier par priorité (haute en premier)
        const priorityA = priorityOrder[a.priority || 'medium'];
        const priorityB = priorityOrder[b.priority || 'medium'];
        return priorityA - priorityB;
    });
    
    // Afficher les tâches
    sortedTasks.forEach(task => {
        const li = document.createElement('li');
        const priority = task.priority || 'medium';
        li.className = `task-item ${task.completed ? 'completed' : ''} has-details priority-${priority}`;
        li.setAttribute('data-task-id', task.id);
        
        // Récupérer le pourcentage de completion
        const completionPercentage = task.completionPercentage || 0;
        
        // Construire le HTML de la tâche
        let taskHTML = `
            <div class="task-header">
                <span class="expand-icon">▶</span>
                <input 
                    type="checkbox" 
                    class="task-checkbox" 
                    ${task.completed ? 'checked' : ''}
                    data-task-id="${task.id}"
                >
                <span class="task-priority-badge priority-${priority}"></span>
                <span class="task-text">${escapeHtml(task.text)}</span>
                <button class="delete-btn" data-task-id="${task.id}">Supprimer</button>
            </div>
        `;
        
        // Ajouter la barre de progression simple en haut avec le pourcentage
        taskHTML += `
            <div class="task-progress-bar-simple">
                <div class="task-progress-bar">
                    <div class="task-progress-fill" style="width: ${completionPercentage}%"></div>
                </div>
                <span class="task-progress-percentage">${completionPercentage}%</span>
            </div>
        `;
        
        // Toujours afficher les détails (priorité, progression, description, lien)
        taskHTML += '<div class="task-details">';
        
        // Ajouter le sélecteur de priorité
        taskHTML += `
            <div class="task-priority-editor">
                <label>Priorité:</label>
                <select class="task-priority-select-edit" data-task-id="${task.id}">
                    <option value="low" ${priority === 'low' ? 'selected' : ''}>Basse</option>
                    <option value="medium" ${priority === 'medium' ? 'selected' : ''}>Moyenne</option>
                    <option value="high" ${priority === 'high' ? 'selected' : ''}>Haute</option>
                </select>
            </div>
        `;
        
        // Ajouter le contrôle de completion
        taskHTML += `
            <div class="task-completion-editor">
                <label>Progression:</label>
                <div class="completion-control">
                    <input 
                        type="range" 
                        class="task-progress-slider" 
                        min="0" 
                        max="100" 
                        value="${completionPercentage}"
                        data-task-id="${task.id}"
                    >
                    <input 
                        type="number" 
                        class="task-progress-number" 
                        min="0" 
                        max="100" 
                        value="${completionPercentage}"
                        data-task-id="${task.id}"
                    >
                    <span class="completion-percent">%</span>
                </div>
            </div>
        `;
        
        // Ajouter la description si elle existe
        if (task.description) {
            taskHTML += `
                <div class="task-description">${escapeHtml(task.description)}</div>
            `;
        }
        
        // Ajouter l'éditeur de lien
        taskHTML += `
            <div class="task-link-editor">
                <label>Lien:</label>
                <input 
                    type="text" 
                    class="task-link-input" 
                    placeholder="Ajouter un lien..." 
                    value="${task.link ? escapeHtml(task.link) : ''}"
                    data-task-id="${task.id}"
                    maxlength="500"
                >
        `;
        
        // Afficher le lien s'il existe
        if (task.link) {
            taskHTML += `
                <div class="task-link-display">
                    📎 <a href="${escapeHtml(task.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(task.link)}</a>
                </div>
            `;
        }
        
        taskHTML += '</div>';
        
        taskHTML += '</div>';
        
        li.innerHTML = taskHTML;
        
        // Ajouter les event listeners
        const header = li.querySelector('.task-header');
        const checkbox = li.querySelector('.task-checkbox');
        const deleteBtn = li.querySelector('.delete-btn');
        
        // Toggle expand au clic sur le header (pour toutes les tâches)
        header.addEventListener('click', (e) => {
            if (e.target !== checkbox && e.target !== deleteBtn) {
                toggleExpand(e);
            }
        });
        
        // Toggle task completion
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTask(task.id);
        });
        
        // Delete task
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTask(task.id);
        });
        
        // Modifier la completion avec le slider
        const progressSlider = li.querySelector('.task-progress-slider');
        const progressNumber = li.querySelector('.task-progress-number');
        
        if (progressSlider) {
            progressSlider.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            progressSlider.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            });
            progressSlider.addEventListener('input', (e) => {
                e.stopPropagation();
                const newPercentage = parseInt(e.target.value) || 0;
                // Mettre à jour l'input numérique aussi
                if (progressNumber) {
                    progressNumber.value = newPercentage;
                }
                updateTaskCompletion(task.id, newPercentage);
            });
        }
        
        if (progressNumber) {
            progressNumber.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            progressNumber.addEventListener('change', (e) => {
                e.stopPropagation();
                let newPercentage = parseInt(e.target.value) || 0;
                // Limiter entre 0 et 100
                newPercentage = Math.max(0, Math.min(100, newPercentage));
                e.target.value = newPercentage;
                // Mettre à jour le slider aussi
                if (progressSlider) {
                    progressSlider.value = newPercentage;
                }
                updateTaskCompletion(task.id, newPercentage);
            });
        }
        
        // Modifier la priorité
        const prioritySelect = li.querySelector('.task-priority-select-edit');
        if (prioritySelect) {
            prioritySelect.addEventListener('change', (e) => {
                e.stopPropagation();
                const newPriority = e.target.value;
                updateTaskPriority(task.id, newPriority);
            });
        }
        
        // Modifier le lien
        const linkInput = li.querySelector('.task-link-input');
        if (linkInput) {
            linkInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            linkInput.addEventListener('change', (e) => {
                e.stopPropagation();
                const newLink = e.target.value.trim() || null;
                updateTaskLink(task.id, newLink);
            });
        }
        
        taskList.appendChild(li);
    });
}

// Fonction pour charger les tâches depuis Firestore
async function loadTasks() {
    try {
        const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        tasks = [];
        querySnapshot.forEach((doc) => {
            tasks.push({
                id: doc.id,
                ...doc.data()
            });
        });
    } catch (error) {
        console.error("Erreur lors du chargement des tâches:", error);
        // Fallback vers localStorage si Firestore ne fonctionne pas
        const savedTasks = localStorage.getItem('tasks');
        if (savedTasks) {
            tasks = JSON.parse(savedTasks);
        }
    }
}

// Fonction pour échapper les caractères HTML (sécurité)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fonction pour obtenir le numéro de semaine
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

// Fonction pour obtenir la date du lundi de la semaine
function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// Fonction pour logger une action
async function logAction(action, taskTitle, details = {}) {
    const now = new Date();
    const monday = getMondayOfWeek(now);
    const weekNumber = getWeekNumber(now);
    
    const log = {
        action: action, // 'added', 'completed', 'deleted'
        taskTitle: taskTitle,
        taskDescription: details.description || null,
        taskLink: details.link || null,
        timestamp: now.toISOString(),
        weekStart: monday.toISOString(),
        weekNumber: weekNumber,
        year: now.getFullYear()
    };
    
    try {
        await addDoc(collection(db, 'logs'), log);
    } catch (error) {
        console.error("Erreur lors du logging:", error);
    }
}

// Fonction pour charger les logs depuis Firestore
async function loadLogs() {
    try {
        const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        logs = [];
        querySnapshot.forEach((doc) => {
            logs.push({
                id: doc.id,
                ...doc.data()
            });
        });
        console.log('Logs chargés:', logs);
    } catch (error) {
        console.error("Erreur lors du chargement des logs:", error);
    }
}

// Fonction pour afficher les logs
function displayLogs() {
    console.log('displayLogs appelée, logs total:', logs.length, 'currentFilter:', currentFilter);
    logsList.innerHTML = '';
    
    // Filtrer les logs selon le filtre actif
    let filteredLogs = logs;
    if (currentFilter !== 'all') {
        filteredLogs = logs.filter(log => log.action === currentFilter);
    }
    
    // Éviter les doublons pour les tâches complétées
    // Garder seulement le premier log "completed" par tâche
    const completedTasks = new Set();
    filteredLogs = filteredLogs.filter(log => {
        if (log.action === 'completed') {
            if (completedTasks.has(log.taskTitle)) {
                return false; // Ignorer les doublons
            }
            completedTasks.add(log.taskTitle);
        }
        return true;
    });
    
    console.log('Logs filtrés:', filteredLogs.length);
    
    if (filteredLogs.length === 0) {
        emptyLogs.classList.remove('hidden');
        return;
    }
    
    emptyLogs.classList.add('hidden');
    
    filteredLogs.forEach(log => {
        const logItem = document.createElement('div');
        logItem.className = `log-item ${log.action}`;
        
        const date = new Date(log.timestamp);
        const weekStart = new Date(log.weekStart);
        const dateStr = date.toLocaleDateString('fr-FR', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const weekStr = weekStart.toLocaleDateString('fr-FR', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        
        let actionText = '';
        switch(log.action) {
            case 'added':
                actionText = 'Ajoutée';
                break;
            case 'completed':
                actionText = 'Complétée';
                break;
            case 'deleted':
                actionText = 'Supprimée';
                break;
        }
        
        let logHTML = `
            <div class="log-header">
                <span class="log-action ${log.action}">${actionText}</span>
                <span class="log-date">${dateStr}</span>
            </div>
            <div class="log-task-title">${escapeHtml(log.taskTitle)}</div>
            <div class="log-week">Semaine du ${weekStr}</div>
        `;
        
        if (log.taskDescription) {
            logHTML += `<div class="task-description" style="margin-top: 8px;">${escapeHtml(log.taskDescription)}</div>`;
        }
        
        if (log.taskLink) {
            logHTML += `
                <div class="task-link" style="margin-top: 4px;">
                    📎 <a href="${escapeHtml(log.taskLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(log.taskLink)}</a>
                </div>
            `;
        }
        
        logItem.innerHTML = logHTML;
        logsList.appendChild(logItem);
    });
}

// Fonction pour configurer les écouteurs d'onglets
function setupTabListeners() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const currentTasksSection = document.querySelector('.add-task-container').parentElement;
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Retirer la classe active de tous les boutons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentTab = btn.dataset.tab;
            
            // Afficher/masquer les sections appropriées
            if (currentTab === 'current') {
                document.querySelector('.add-task-container').classList.remove('hidden');
                document.querySelector('.stats').classList.remove('hidden');
                taskList.classList.remove('hidden');
                emptyState.classList.remove('hidden');
                historySection.classList.add('hidden');
            } else {
                document.querySelector('.add-task-container').classList.add('hidden');
                document.querySelector('.stats').classList.add('hidden');
                taskList.classList.add('hidden');
                emptyState.classList.add('hidden');
                historySection.classList.remove('hidden');
                displayLogs();
            }
        });
    });
}

// Fonction pour configurer les écouteurs de filtres
function setupFilterListeners() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Retirer la classe active de tous les boutons
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentFilter = btn.dataset.filter;
            displayLogs();
        });
    });
}

// Fonction pour obtenir la clé de semaine (année-semaine)
function getWeekKey(date) {
    const weekNum = getWeekNumber(date);
    const year = date.getFullYear();
    return `${year}-W${weekNum}`;
}

// Fonction pour vérifier et nettoyer les tâches en début de nouvelle semaine
async function checkAndCleanWeek() {
    try {
        const now = new Date();
        const currentWeekKey = getWeekKey(now);
        
        // Récupérer la dernière semaine enregistrée
        const lastWeekKey = localStorage.getItem('lastWeekKey');
        
        // Si c'est une nouvelle semaine
        if (lastWeekKey && lastWeekKey !== currentWeekKey) {
            console.log('Nouvelle semaine détectée, nettoyage des tâches complétées...');
            
            // Charger toutes les tâches
            const q = query(collection(db, 'tasks'));
            const querySnapshot = await getDocs(q);
            
            let deletedCount = 0;
            const deletionPromises = [];
            
            // Supprimer les tâches complétées
            querySnapshot.forEach((document) => {
                const task = document.data();
                if (task.completed) {
                    deletionPromises.push(
                        deleteDoc(doc(db, 'tasks', document.id)).then(() => {
                            // Logger chaque suppression
                            return logAction('deleted', task.text, {
                                description: task.description,
                                link: task.link,
                                autoDeleted: true,
                                reason: 'Nettoyage automatique de nouvelle semaine'
                            });
                        })
                    );
                    deletedCount++;
                }
            });
            
            // Attendre que toutes les suppressions soient terminées
            await Promise.all(deletionPromises);
            
            if (deletedCount > 0) {
                console.log(`${deletedCount} tâche(s) complétée(s) supprimée(s)`);
            }
        }
        
        // Enregistrer la semaine actuelle
        localStorage.setItem('lastWeekKey', currentWeekKey);
        
    } catch (error) {
        console.error("Erreur lors du nettoyage de semaine:", error);
    }
}
