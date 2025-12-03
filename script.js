// Import Firebase configuration
import { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from './firebase-config.js';

// Sélection des éléments du DOM
const taskInput = document.getElementById('taskInput');
const taskDescription = document.getElementById('taskDescription');
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
    const link = taskLink.value.trim();
    
    if (taskText === '') {
        taskInput.focus();
        return;
    }
    
    const task = {
        text: taskText,
        description: description || null,
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
            await updateDoc(doc(db, 'tasks', id), {
                completed: newStatus
            });
            
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
    
    // Afficher les tâches
    tasks.forEach(task => {
        const li = document.createElement('li');
        const hasDetails = task.description || task.link;
        li.className = `task-item ${task.completed ? 'completed' : ''} ${hasDetails ? 'has-details' : ''}`;
        li.setAttribute('data-task-id', task.id);
        
        // Construire le HTML de la tâche
        let taskHTML = `
            <div class="task-header">
                ${hasDetails ? '<span class="expand-icon">▶</span>' : ''}
                <input 
                    type="checkbox" 
                    class="task-checkbox" 
                    ${task.completed ? 'checked' : ''}
                    data-task-id="${task.id}"
                >
                <span class="task-text">${escapeHtml(task.text)}</span>
                <button class="delete-btn" data-task-id="${task.id}">Supprimer</button>
            </div>
        `;
        
        // Ajouter les détails (description et lien) dans un conteneur
        if (hasDetails) {
            taskHTML += '<div class="task-details">';
            
            // Ajouter la description si elle existe
            if (task.description) {
                taskHTML += `
                    <div class="task-description">${escapeHtml(task.description)}</div>
                `;
            }
            
            // Ajouter le lien si il existe
            if (task.link) {
                taskHTML += `
                    <div class="task-link">
                        📎 <a href="${escapeHtml(task.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(task.link)}</a>
                    </div>
                `;
            }
            
            taskHTML += '</div>';
        }
        
        li.innerHTML = taskHTML;
        
        // Ajouter les event listeners
        const header = li.querySelector('.task-header');
        const checkbox = li.querySelector('.task-checkbox');
        const deleteBtn = li.querySelector('.delete-btn');
        
        // Toggle expand au clic sur le header
        if (hasDetails) {
            header.addEventListener('click', (e) => toggleExpand(e, task.id));
        }
        
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
    } catch (error) {
        console.error("Erreur lors du chargement des logs:", error);
    }
}

// Fonction pour afficher les logs
function displayLogs() {
    logsList.innerHTML = '';
    
    // Filtrer les logs selon le filtre actif
    let filteredLogs = logs;
    if (currentFilter !== 'all') {
        filteredLogs = logs.filter(log => log.action === currentFilter);
    }
    
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
