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
  // CORS headers so your app is allowed to make requests
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,GET');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Fetch weather for Asaba
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=6.2096&longitude=6.7011&current=cape,precipitation,weather_code`);
    const weatherData = await weatherRes.json();
    const current = weatherData.current;

    // 2. Calculate Risk (Forced low threshold for testing)
    let score = 0;
    if (current.cape) score += Math.min(30, (current.cape / 2500) * 30);
    if (current.precipitation) score += Math.min(25, (current.precipitation / 10) * 25);
    if ([95, 96, 99].includes(current.weather_code)) score += 20;

    // 3. Send Push if Score is High
    if (score >= 15) {
      // Get all registered tokens from Firebase
      const tokensSnapshot = await db.collection('tokens').get();
      const tokens = tokensSnapshot.docs.map(doc => doc.id);

      if (tokens.length > 0) {
        const message = {
          notification: {
            title: '🚨 LIGHTNING ALERT',
            body: `Critical risk in Asaba! Disconnect solar now. (Score: ${Math.round(score)})`
          },
          tokens: tokens
        };
        
        // 🔥 FIX: Use sendEachForMulticast instead of sendMulticast
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Successfully sent ${response.successCount} messages.`);
      }
    }
    
    res.status(200).send(`Weather check complete. Score: ${Math.round(score)}`);
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({ error: error.message });
  }
};
