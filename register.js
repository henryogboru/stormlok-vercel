const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { token } = req.body;
  if (!token) return res.status(400).send('Token required');

  try {
    // Save the token to Firestore (so we can fetch it later)
    await db.collection('tokens').doc(token).set({ createdAt: admin.firestore.FieldValue.serverTimestamp() });
    res.status(200).json({ success: true, message: 'Token saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};