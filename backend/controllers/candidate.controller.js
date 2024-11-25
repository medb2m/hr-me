import Candidate from "../models/candidate.js";

// create New Candidate
export const createCandidate = async (req, res) => {
    try {
        const { name, email, phone, cin, passportNumber, offer, position, status, experience, skills } = req.body
        const candidateData = {
          name, email, phone, cin, passportNumber, offer, position, status, experience, skills
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
      const candidates = await Candidate.find();
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
}

// Get a specific candidate
export const getCandidateById = async (req, res) => {
    try {
      const candidate = await Candidate.findById(req.params.id).populate('position offers');
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
    const candidateData = req.body;

    if (req.file){
      candidateData.image = `${req.protocol}://${req.get('host')}/img/{req.file.filename}`;
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