// firebase-config.js
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    // ... あなたのFirebase設定 ...
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// このリストに許可するメールアドレスを記述
const allowedEmails = ['hk20008@student.miyazaki-u.ac.jp', 'user2@example.com'];

// 認証状態の監視
onAuthStateChanged(auth, user => {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    // ユーザーがログインしていない、または匿名ログインではない場合
    if (!user || !user.isAnonymous) {
        // ログイン処理を実行
        signInAnonymously(auth);
        return;
    }

    // 匿名ログインしたユーザーのUIDを取得
    const uid = user.uid;

    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    console.log("匿名ユーザーとしてログインしました:", uid);
});