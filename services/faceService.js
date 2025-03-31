const { FaceDetector } = require("@tensorflow-models/face-detection");
const tf = require("@tensorflow/tfjs-node");
const canvas = require("canvas");
const faceapi = require("face-api.js");
const fs = require("fs");
const path = require("path");
const cloudinary = require("../config/cloudinary");

// Patch nodejs environment for face-api.js
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

class FaceService {
  constructor() {
    this.initialized = false;
    this.faceDetector = null;
    this.faceRecognitionNet = null;
    this.faceLandmark68Net = null;
    this.faceRecognitionModels = path.join(
      __dirname,
      "../models/face-recognition-models"
    );
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Load face detection model
      this.faceDetector = await FaceDetector.create({
        modelUrl:
          "https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1",
      });

      // Load face recognition models
      await faceapi.nets.faceRecognitionNet.loadFromDisk(
        this.faceRecognitionModels
      );
      await faceapi.nets.faceLandmark68Net.loadFromDisk(
        this.faceRecognitionModels
      );
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(
        this.faceRecognitionModels
      );

      this.initialized = true;
      console.log("Face recognition models loaded successfully");
    } catch (error) {
      console.error("Error initializing face recognition:", error);
      throw new Error("Failed to initialize face recognition service");
    }
  }

  async detectFace(imageBuffer) {
    await this.initialize();

    try {
      const img = await canvas.loadImage(imageBuffer);
      const detections = await this.faceDetector.estimateFaces(img);

      return detections.length > 0;
    } catch (error) {
      console.error("Error detecting face:", error);
      throw new Error("Face detection failed");
    }
  }

  async compareFaces(
    referenceImageBuffer,
    currentImageBuffer,
    threshold = 0.6
  ) {
    await this.initialize();

    try {
      const referenceImage = await canvas.loadImage(referenceImageBuffer);
      const currentImage = await canvas.loadImage(currentImageBuffer);

      // Create canvases for each image
      const referenceCanvas = canvas.createCanvas(
        referenceImage.width,
        referenceImage.height
      );
      const currentCanvas = canvas.createCanvas(
        currentImage.width,
        currentImage.height
      );

      const referenceCtx = referenceCanvas.getContext("2d");
      const currentCtx = currentCanvas.getContext("2d");

      referenceCtx.drawImage(referenceImage, 0, 0);
      currentCtx.drawImage(currentImage, 0, 0);

      // Detect faces and compute descriptors
      const referenceDetection = await faceapi
        .detectSingleFace(referenceCanvas)
        .withFaceLandmarks()
        .withFaceDescriptor();

      const currentDetection = await faceapi
        .detectSingleFace(currentCanvas)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!referenceDetection || !currentDetection) {
        return {
          match: false,
          message: "Face not detected in one or both images",
        };
      }

      // Calculate distance between face descriptors
      const distance = faceapi.euclideanDistance(
        referenceDetection.descriptor,
        currentDetection.descriptor
      );

      const match = distance < threshold;

      return {
        match,
        distance,
        threshold,
        message: match ? "Face match confirmed" : "Face does not match",
      };
    } catch (error) {
      console.error("Error comparing faces:", error);
      throw new Error("Face comparison failed");
    }
  }

  async captureAndVerifyFace(employeeId, userId, imageBuffer) {
    try {
      const hasFace = await this.detectFace(imageBuffer);

      if (!hasFace) {
        return {
          success: false,
          message: "No face detected in the captured image",
        };
      }

      // Upload image to cloudinary
      const result = await cloudinary.uploader.upload(imageBuffer, {
        folder: `employees/${employeeId}/attendance`,
        resource_type: "image",
      });

      return {
        success: true,
        imageUrl: result.secure_url,
        publicId: result.public_id,
        message: "Face captured and verified successfully",
      };
    } catch (error) {
      console.error("Error capturing and verifying face:", error);
      throw new Error("Face capture and verification failed");
    }
  }

  async captureRandomImages(employeeId, workPeriod, breakPeriod, count = 10) {
    // This would be called by a scheduled job
    // Return a configuration object that will be used by front-end
    // to capture images at specified times

    try {
      // Calculate work hours excluding break period
      const workStart = new Date(`1970-01-01T${workPeriod.start}`);
      const workEnd = new Date(`1970-01-01T${workPeriod.end}`);

      const breakStart = breakPeriod
        ? new Date(`1970-01-01T${breakPeriod.start}`)
        : null;
      const breakEnd = breakPeriod
        ? new Date(`1970-01-01T${breakPeriod.end}`)
        : null;

      // Calculate total work minutes excluding break
      let totalWorkMinutes = (workEnd - workStart) / (60 * 1000);

      if (breakStart && breakEnd) {
        const breakMinutes = (breakEnd - breakStart) / (60 * 1000);
        totalWorkMinutes -= breakMinutes;
      }

      // Generate random capture times
      const captureTimes = [];
      for (let i = 0; i < count; i++) {
        let randomMinute;
        let captureTime;

        do {
          // Generate a random minute within the work period
          randomMinute = Math.floor(Math.random() * totalWorkMinutes);
          captureTime = new Date(
            workStart.getTime() + randomMinute * 60 * 1000
          );

          // Check if time is during break period
          const duringBreak =
            breakStart &&
            breakEnd &&
            captureTime >= breakStart &&
            captureTime <= breakEnd;

          // If not during break, add to capture times
          if (!duringBreak) {
            break;
          }
        } while (true);

        captureTimes.push(captureTime.toTimeString().slice(0, 8));
      }

      // Sort by time
      captureTimes.sort();

      return {
        employeeId,
        date: new Date().toISOString().slice(0, 10),
        captureTimes,
      };
    } catch (error) {
      console.error("Error generating random capture times:", error);
      throw new Error("Failed to generate random capture times");
    }
  }
}

module.exports = new FaceService();
