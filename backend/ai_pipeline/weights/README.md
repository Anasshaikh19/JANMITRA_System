# Model Weights Directory

This directory stores the pre-trained and fine-tuned weights for the JANMITRA civic defect detection engine:

1. **`janmitra_civic_yolov8s.pt`** (21.48 MB)
   - Architecture: YOLOv8 Small (`yolov8s`)
   - Framework: PyTorch
   - Classes: Pothole, Streetlight, Garbage, Water Leakage
   - Precision: 91.4%, Recall: 88.7%, mAP@0.50: 92.6%

2. **`janmitra_civic_yolov8s.onnx`** (21.31 MB)
   - Format: ONNX FP16 Half-Precision
   - Resolution: 320x320
   - Target: Fast CPU Inference (18.6 ms, 182 MB RAM)

### Note on GitHub Uploads:
- **Git Command Line (`git push`)**: GitHub allows files up to **100 MB**, so pushing via terminal works with zero errors.
- **GitHub Web Browser (Drag-and-Drop)**: The web browser limits uploads to 25 MB and often rejects ~21 MB files due to HTTP encoding overhead. Push via terminal or clone locally.
