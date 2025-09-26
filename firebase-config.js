// firebase-config.js

// import文をすべて削除

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD9bHuHOHW6rrSUM5YBq3vLRuh6mAvKja0",
    authDomain: "arailabkarenda.firebaseapp.com",
    projectId: "arailabkarenda",
    storageBucket: "arailabkarenda.firebasestorage.app",
    messagingSenderId: "915224620423",
    appId: "1:915224620423:web:f6ade2797513bf6756f722",
    measurementId: "G-TLHCHP6TL0"
};

// firebase.initializeApp()はグローバルな関数に
firebase.initializeApp(firebaseConfig);

// グローバルなfirebaseオブジェクトからサービスを取得
export const auth = firebase.auth();
export const db = firebase.firestore();

// 許可するメールアドレスのリストを定義
const allowedEmails = ['user1@example.com', 'user2@example.com', 'your_email@example.com'];

// onAuthStateChangedもグローバルなauthオブジェクトから呼び出す
firebase.auth().onAuthStateChanged(user => {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    if (user) {
        authContainer.style.display = 'none';
        appContainer.style.display = 'block';
        console.log("ユーザーがログインしました:", user.email);
    } else {
        authContainer.style.display = 'block';
        appContainer.style.display = 'none';
        console.log("ユーザーはログアウトしています。");
    }
});
