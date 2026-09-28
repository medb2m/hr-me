import multer from 'multer';

/**
 * Exécute un middleware Multer `single` et renvoie des erreurs 400 lisibles.
 * @param {import('multer').Multer} instance
 * @param {string} fieldName
 * @returns {import('express').RequestHandler}
 */
export function multerSingleHandler(instance, fieldName) {
  return (req, res, next) => {
    instance.single(fieldName)(req, res, (err) => {
      if (!err) {
        return next();
      }
      if (err instanceof multer.MulterError) {
        const messages = {
          LIMIT_FILE_SIZE: 'Fichier trop volumineux.',
          LIMIT_UNEXPECTED_FILE: 'Champ fichier inattendu. Utilisez le champ « photo ».',
        };
        return res.status(400).json({
          message: messages[err.code] || err.message,
          code: err.code,
        });
      }
      if (err.message === 'PROFILE_IMAGE_TYPE') {
        return res.status(400).json({
          message: 'Type de fichier non autorisé (JPEG, PNG ou WebP).',
          code: 'PROFILE_IMAGE_TYPE',
        });
      }
      return next(err);
    });
  };
}
