// firebase-config.js
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// 許可されたメールアドレスのリストは不要になります
// 代わりに、匿名ユーザーのUIDを使ってデータを管理します

onAuthStateChanged(auth, user => {
    // ユーザーがログインしていない場合
    if (!user) {
        // 匿名ユーザーとしてログイン
        signInAnonymously(auth);
    } else {
        // ログイン状態であれば何もしない
        console.log("ユーザーがログインしました:", user.uid);
    }
});
