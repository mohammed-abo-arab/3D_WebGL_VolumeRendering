# **3D_WebGL_VolumeRendering**
**High-Performance WebGL-Based 3D Visualization for Large-Scale Volumetric Medical Datasets**

## **Overview**
**3D_WebGL_VolumeRendering** is an advanced **WebGL-based volume rendering** framework for visualizing **large-scale medical imaging datasets**. The system integrates **Level of Detail (LOD) optimization**, **progressive chunk streaming**, and **adaptive resolution** techniques to enhance rendering performance and maintain high-fidelity visualization.

This tool is optimized for **interactive 3D visualization of computed tomography (CT) datasets**, specifically for **peripheral artery imaging**. The framework supports **real-time rendering within web browsers**, eliminating the need for additional software installations.

## **Live Demo**
🔗 **Try it online:** [DECODE-3DViz Live Demo](https://mohammedaboarab.pythonanywhere.com/)

## **Installation Instructions**
To set up and run the project locally, follow these steps:

### **1. Clone the Repository**

git clone https://github.com/mohammed-abo-arab/3D_WebGL_VolumeRendering.git
cd 3D_WebGL_VolumeRendering

### **2. Install Dependencies**
Ensure Python 3.7+ is installed, then install the required dependencies:
pip install -r requirements.txt

### **3. Run the Server**
Start the Django development server:
python manage.py runserver

### **4. Open in Browser**
Once the server is running, access the web application at:
http://127.0.0.1:8000/

### **Key Features**

✅ WebGL-Powered Interactive 3D Visualization

✅ Level of Detail (LOD) Optimization for Efficient Rendering

✅ Progressive Data Streaming for Large CT Images

✅ Dynamic Region of Interest (ROI) Rerendering

✅ Cross-Platform Browser-Based Visualization

✅ GPU-Efficient High-Performance Rendering

### **System Requirements**

Python ≥ 3.7

Django ≥ 3.x

WebGL-Compatible Browser (Chrome, Firefox, Edge)

NVIDIA/AMD GPU Recommended for Optimal Performance

### **Usage**

Upload CT datasets in DICOM/NIfTI format.

Navigate through the 3D volume using the interactive WebGL viewer.

Adjust LOD settings to optimize visualization performance.

Focus on regions of interest (ROI) for enhanced diagnostic precision.
