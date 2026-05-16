require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const connectDB = require('./config/database');
const uploadService = require('./uploads');

// Initialisation de l'application
const app = express();

// Middlewares de sécurité
app.use(helmet());

// CORS - Accepter toutes les origines
const allowedOrigins = process.env.ALLOWED_ORIGINS || '*';

app.use(cors({
  origin: allowedOrigins === '*' ? true : function (origin, callback) {
    // Autoriser les requêtes sans origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const origins = allowedOrigins.split(',');
    if (origins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true
}));

// Body parser - Augmenter la limite pour les PDF en base64
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes principales
app.use('/api/products', require('./routes/products'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/auth', require('./routes/auth'));

// ==================== ROUTES D'UPLOAD ====================
// Route d'upload PDF vers Cloudinary
app.post('/api/upload-to-cloud', express.json({ limit: '20mb' }), uploadService.uploadPDF.bind(uploadService));

// Route de santé
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Serveur opérationnel',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      upload: 'active'
    }
  });
});

// Route racine
app.get('/', (req, res) => {
  res.json({
    message: 'API de Gestion de Factures',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      products: '/api/products',
      clients: '/api/clients',
      invoices: '/api/invoices',
      auth: '/api/auth',
      upload: 'POST /api/upload-to-cloud'
    }
  });
});

// Gestion des routes non trouvées
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée'
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Créer l'utilisateur admin par défaut si aucun n'existe
const initializeDefaultUser = async () => {
  try {
    const User = require('./models/User');
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const defaultUser = new User({ username: 'admin', password: '1234' });
      await defaultUser.save();
      console.log('👤 Utilisateur par défaut créé: admin / 1234');
    }
  } catch (error) {
    console.error('Erreur création utilisateur par défaut:', error.message);
  }
};

// Démarrage : DB d'abord, puis serveur
const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectDB();
  await initializeDefaultUser();
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
  });
};

start();

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM reçu, arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT reçu, arrêt du serveur...');
  process.exit(0);
});