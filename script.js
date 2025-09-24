// 商品データ
const products = {
    'apple': { name: 'りんご', price: 150 },
    'orange': { name: 'みかん', price: 100 },
    'grape': { name: 'ぶどう', price: 300 }
};

/**
 * 注文を確定する関数
 */
function placeOrder() {
    const orderDetails = {};
    let totalQuantity = 0;
    let totalPrice = 0;

    // 各商品の数量を取得し、注文データを構築
    for (const key in products) {
        const quantityInput = document.getElementById(`quantity-${key}`);
        const quantity = parseInt(quantityInput.value);

        if (quantity > 0) {
            orderDetails[key] = {
                name: products[key].name,
                quantity: quantity,
                price: products[key].price,
                subtotal: quantity * products[key].price
            };
            totalQuantity += quantity;
            totalPrice += orderDetails[key].subtotal;
        }
    }

    const confirmationMessage = document.getElementById('confirmation-message');

    // 注文が空かどうかをチェック
    if (totalQuantity === 0) {
        confirmationMessage.textContent = '数量を1つ以上選択してください。';
        confirmationMessage.style.color = 'red';
        return;
    }

    // 注文データの構造を確認
    console.log("注文データ:", orderDetails);
    console.log("合計数量:", totalQuantity);
    console.log("合計金額:", totalPrice);

    // TODO: この注文データをFirebaseに送信する処理をここに追加
    // 例: firebase.firestore().collection('orders').add(orderDetails);

    confirmationMessage.textContent = `ご注文ありがとうございます！合計金額は ¥${totalPrice} です。`;
    confirmationMessage.style.color = 'green';
}