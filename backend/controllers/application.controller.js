import {Offer} from '../models/offer.js'
import { Application } from '../models/application.js';


export const createApplication = async (req, res) => {
    try {
      const { candidateId, offerId, positionId, status, notes } = req.body;
  
      // Validate that the position exists in the offer
      const offer = await Offer.findById(offerId).populate('positions.positionId');
      if (!offer) return res.status(404).json({ error: 'Offer not found' });
  
      const position = offer.positions.find(
        (pos) => pos.positionId._id.toString() === positionId.toString()
      );
      if (!position) return res.status(404).json({ error: 'Position not found in this offer' });
  
      // Create the application
      const application = new Application({
        candidate: candidateId,
        offer: offerId,
        position: positionId,
        status,
        notes,
      });
  
      await application.save();
  
      // Update the position's achieved candidates count
      position.candidatesAchieved += 1;
      // Add the application to the offer's applications list
      offer.applications.push(application._id);
      await offer.save();
  
      res.status(201).json(application);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  };

  export const getAllApplicationsByOffer = async (req, res) => {
    try {
      const offerId = req.params.id;
  
      const applications = await Application.find({ offer: offerId })
        .populate('candidate')
        .populate('position');

  
      res.status(200).json(applications);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  export const getAllApplicationsByCandidate = async (req, res) => {
    try {
      const candidateId = req.params.id;
  
      const applications = await Application.find({ candidate: candidateId })
        .populate('offer')
        .populate('position');
  
      res.status(200).json(applications);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

export const getAssignedCandidatesByOfferId = async (req, res) => {
    try{
        const offerId  = req.params.id;
        console.log(offerId)

        // Find applications for the given offer and populate the candidate details
        const applications = await Application.find({ offer: offerId }).populate('candidate');

        if (!applications || applications.length === 0) {
            return res.status(404).json({ message: 'No assigned candidates found for this offer.' });
          }
        // Extract only the candidate details from the populated applications
        const assignedCandidates = applications.map((app) => app.candidate);
        res.status(200).json(assignedCandidates);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
      }
}
  