import multer, { diskStorage } from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// les extensions à accepter image
const MIME_TYPES = {
    "images/jpg" : "jpg",
    "images/jpeg" : "jpg",
    "images/png" : "png",
}
// Configuration de stockage pour les images
const imageStorage = diskStorage({
    destination: (req, file, callback) => {
        const __dirname = dirname(fileURLToPath(import.meta.url)); // Récupérer le chemin du dossier courant 
        callback(null, join(__dirname, "../public/images")); // Indiquer l'emplacement du stockage des images
    },
    filename: (req, file, callback) => {
        // Remplacer les espaces par des underscores dans le nom de fichier original
        const name = file.originalname.split(" ").join("_");
        // Récupérer l'extension à utiliser pour le fichier image
        const extension = MIME_TYPES[file.mimetype];
        
        // Ajouter un timestamp Date.now() au nom du fichier
        const nomF = Date.now() + name;
        callback(null, nomF);
    },
});

// Middleware Multer pour l'upload d'images
const uploadImage = multer({
    storage: imageStorage,  
    // Limite de taille maximale pour les images (10 Mo)
    limits: { fileSize: 10 * 1024 * 1024 }, // Taille max des images : 10 Mo
    // Filtre pour les types MIME autorisés pour les images
    
});

export { uploadImage };