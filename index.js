// --- PHẦN 1: KHỞI TẠO CÁC DỊCH VỤ ---

// Import các thư viện cần thiết
const express = require('express');
const admin = require('firebase-admin');

// Đọc file chìa khóa bí mật
const serviceAccount = require('./serviceAccountKey.json');

// Khởi tạo ứng dụng Express để Render có thể ping
const app = express();
const PORT = process.env.PORT || 3000;

// Khởi tạo Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Lấy các dịch vụ Firestore và Messaging
const db = admin.firestore();
const messaging = admin.messaging();

console.log("Firebase Admin SDK initialized. Starting server...");


// --- PHẦN 2: LẮNG NGHE DỮ LIỆU TỪ FIRESTORE ---

// Hàm để bắt đầu lắng nghe collection 'notifications'
function listenForNotifications() {
    db.collection("notifications").onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            // Chỉ xử lý khi có một tài liệu mới được 'thêm' vào
            if (change.type === 'added') {
                const notificationData = change.doc.data();
                console.log("New notification received:", notificationData);
                // Gọi hàm gửi push notification
                sendPushNotification(notificationData);
            }
        });
    });
}


// --- PHẦN 3: HÀM GỬI PUSH NOTIFICATION (ĐÃ SỬA LỖI) ---

async function sendPushNotification(notification) {
    // Lấy ID và thông tin của người nhận
    const recipientId = notification.recipientId;
    if (!recipientId) {
        console.log("Error: Recipient ID is missing.");
        return;
    }

    try {
        // Bước A: Tìm fcmToken của người nhận trong collection 'users'
        const userDoc = await db.collection('users').doc(recipientId).get();

        if (!userDoc.exists) {
            console.log(`Error: User document not found for ID: ${recipientId}`);
            return;
        }

        const fcmToken = userDoc.data().fcmToken;
        if (!fcmToken) {
            console.log(`Error: FCM token not found for user: ${recipientId}`);
            return;
        }

        // Bước B: Chuẩn bị payload hoàn chỉnh trong một đối tượng duy nhất
        const message = {
            notification: {
                title: `Thông báo từ ${notification.senderName}`,
                body: notification.message,
            },
            token: fcmToken,
        };

        // Bước C: Gửi thông báo bằng cách truyền vào toàn bộ đối tượng 'message'
        console.log(`Sending notification to token: ${fcmToken}`);
        const response = await messaging.send(message);
        console.log('Successfully sent message:', response);

    } catch (error) {
        console.error('Error sending message:', error);
    }
}


// --- PHẦN 4: KHỞI ĐỘNG SERVER ---

// Tạo một route cơ bản để Render kiểm tra "sức khỏe"
app.get('/', (req, res) => {
    res.send('Notification server is running.');
});

// Lắng nghe ở port được chỉ định
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    // Bắt đầu lắng nghe Firestore sau khi server đã sẵn sàng
    listenForNotifications();
});
