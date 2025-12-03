// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDyO36utk43t5uDBTD4wHzJcHjD1TDf35s",
  authDomain: "to-do-list-66f6f.firebaseapp.com",
  projectId: "to-do-list-66f6f",
  storageBucket: "to-do-list-66f6f.firebasestorage.app",
  messagingSenderId: "877716171640",
  appId: "1:877716171640:web:8d4372df4c46e063ce768d",
  measurementId: "G-CQ9LXBWTNF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy };
