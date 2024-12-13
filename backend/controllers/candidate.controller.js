import Candidate from "../models/candidate.js";

// create New Candidate
export const createCandidate = async (req, res) => {
    try {
        const { name, email, phone, cin, passportNumber, offer, position, status, experience, skills } = req.body
        const candidateData = {
          name, email, phone, cin, passportNumber, offer, position, status, experience, skills :JSON.parse(skills)
        }
        if (req.file) {
          candidateData.image = `${req.protocol}://${req.get("host")}/img/${req.file.filename}`
        }
        const candidate = new Candidate(candidateData);
        await candidate.save();
        res.status(201).json(candidate);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
}

// Get all candidates
export const getAllCandidates = async (req, res) => {
    try {
      const candidates = await Candidate.find().populate('position offers');
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
}

// Get a specific candidate
export const getCandidateById = async (req, res) => {
    try {
      const candidate = await Candidate.findById(req.params.id).populate('position offers').populate('skills.skill');
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }
      res.json(candidate);
    } catch (error) {
      res.status(404).json({ error: 'Candidate not found' });
    }
}

// Update Candidate
export const updateCandidate = async (req, res) => {
  try {
    const  { id } = req.params;
    const { name, email, phone, cin, passportNumber, offer, position, status, experience, skills } = req.body
        const candidateData = {
          name, email, phone, cin, passportNumber, offer, position, status, experience, skills :JSON.parse(skills)
        }

    if (req.file){
      candidateData.image = `${req.protocol}://${req.get('host')}/img/${req.file.filename}`;
    }

    const updatedCandidate = await Candidate.findByIdAndUpdate(id, candidateData, {new: true});
    if (!updatedCandidate){
      return res.status(404).json({message: 'Candidate not found'})
    }

    res.status(200).json(updatedCandidate)
  } catch (error) {
    res.status(400).json({error: error.message})
  }
}

// Add or Update Files in Candidate Dossier
export const updateDossier = async (req, res) => {
  try {
    const { id } = req.params; // Candidate ID

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }

    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' });
    }

    const updatedFiles = [];
    const allowedFileTypes = ['passport', 'cv', 'diploma', 'other'];

    req.files.forEach((file, index) => {
      const fileType = req.body.fileTypes[index]; // Access directly as an array

      if (!allowedFileTypes.includes(fileType)) {
        throw new Error(`Invalid file type: ${fileType}. Allowed types are: ${allowedFileTypes.join(', ')}`);
      }
      
      const newFileData = {
        fileType,
        filename: file.originalname,
        filepath: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`,
        uploadedAt: new Date(),
        status: 'uploaded',
      };

      // Check if the fileType already exists in the dossier
      const existingFileIndex = candidate.dossier.findIndex((doc) => doc.fileType === fileType);

      if (existingFileIndex !== -1) {
        // Update existing file
        candidate.dossier[existingFileIndex] = newFileData;
      } else {
        // Add new file
        candidate.dossier.push(newFileData);
      }

      updatedFiles.push(file.originalname);
    });

    await candidate.save();

    res.status(200).json({
      success: true,
      message: 'Dossier updated successfully!',
      updatedFiles,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Get Dossier Details
export const getDossier = async (req, res) => {
  try {
    const { id } = req.params; // Candidate ID
    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json(candidate.dossier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Handle Missing Files
export const checkDossierStatus = async (req, res) => {
  try {
    const { id } = req.params; // Candidate ID
    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const requiredFiles = ['passport', 'cin', 'cv', 'diploma'];
    const uploadedFiles = candidate.dossier.map(file => file.fileType);

    const missingFiles = requiredFiles.filter(file => !uploadedFiles.includes(file));

    res.json({
      dossier: candidate.dossier,
      missingFiles,
      status: missingFiles.length === 0 ? 'dossier complet' : 'dossier incomplet',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


