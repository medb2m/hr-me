import multer, { diskStorage } from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Configuration de stockage pour les images
const storage = diskStorage({
    destination: (req, file, callback) => {
        const __dirname = dirname(fileURLToPath(import.meta.url)); // Récupérer le chemin du dossier courant 
        callback(null, join(__dirname, "../public/uploads")); // Indiquer l'emplacement du stockage des images
    },
    filename: (req, file, callback) => {
        // Remplacer les espaces par des underscores dans le nom de fichier original
        const name = file.originalname.split(" ").join("_");
        
        // Ajouter un timestamp Date.now() au nom du fichier
        const nomF = Date.now() + name;
        callback(null, nomF);
    }
});

// Middleware Multer pour l'upload d'images
const uploadFiles = multer({
    storage: storage,  
    limits: { fileSize: 20 * 1024 * 1024 }
});

export { uploadFiles };