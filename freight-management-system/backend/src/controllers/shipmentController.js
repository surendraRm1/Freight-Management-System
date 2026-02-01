const shipmentService = require('../services/shipmentService');

const createManualShipment = async (req, res, next) => {
  try {
    const shipment = await shipmentService.createShipment(req.body, req.user);
    res.status(201).json(shipment);
  } catch (error) {
    next(error);
  }
};

const getAllShipments = async (req, res, next) => {
  try {
    const shipments = await shipmentService.getAllShipments(req.user?.companyId);
    res.status(200).json(shipments);
  } catch (error) {
    next(error);
  }
};

const uploadPOD = async (req, res, next) => {
  try {
    const shipmentId = parseInt(req.params.id, 10);
    const shipment = await shipmentService.uploadPOD(shipmentId, req.user?.companyId, req.body);
    res.status(200).json(shipment);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createManualShipment,
  getAllShipments,
  uploadPOD,
};
