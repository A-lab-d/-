// Firebase SDKのインポート
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// Firebaseサービスへの参照を取得し、エクスポート
export const auth = getAuth(app);
export const db = getFirestore(app);

// 許可されたメールアドレスのリスト
const allowedEmails = ['user1@example.com', 'user2@example.com'];

// 認証状態の監視
onAuthStateChanged(auth, user => {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    if (user) {
        // ユーザーがログインしている場合、メールアドレスをチェック
        if (allowedEmails.includes(user.email)) {
            authContainer.style.display = 'none';
            appContainer.style.display = 'block';
            console.log("ユーザーがログインしました:", user.email);
        } else {
            // 許可されていないユーザーはログアウト
            signOut(auth);
            alert('このメールアドレスは許可されていません。');
            authContainer.style.display = 'block';
            appContainer.style.display = 'none';
        }
    } else {
        // ユーザーがログアウトしている場合
        authContainer.style.display = 'block';
        appContainer.style.display = 'none';
        console.log("ユーザーはログアウトしています。");
    }
});