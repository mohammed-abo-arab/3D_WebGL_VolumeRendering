// max3DTextureSize at the top level
let max3DTextureSize;
let volume_imageData = []; // Declare volume_imageData as an array at the top level

// Global variable for cropped dimensions
let croppedDimensions = null;
let volume_color_val = []; // Define volume_color_val
let dimen;
let itkImages = []; // Global variable to store original itkImage data
let ijkPlanes = []; // Initialize as an empty array
let renderer; // Initialize as a global variable
let renderWindow; // Initialize as a global variable
let downsampledDim = []; // Initialize as a global variable of downsampled dimensions
let originalDim = [];
//
let vtkImageDataOrg;
let vtkImageData;
let originalResolutionImages = []; // Global variable to store original resolution images
//
let combinedImage1 = []; // Initialize original data as a global variable
let combinedDimensions = []; // Global variable to store combined dimensions
let volImgDimensions = []; // Global variable to store the dimension of downsample data
////////////////////////////////////////////////////////////////////////////////
let chunkSize;
let maxUploadMemoryMB;

document.addEventListener("DOMContentLoaded", function () {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");

  if (!gl) {
    console.error("WebGL 2 is not supported by your browser.");
    return;
  }

  // Query the maximum 3D texture size allowed by WebGL 2.0
  max3DTextureSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
  console.log("Maximum 3D texture size:", max3DTextureSize);
  // Check available memory
  if (performance.memory) {
    const memory = performance.memory;
    const jsHeapSizeLimitMB = memory.jsHeapSizeLimit / 1024 / 1024; // Convert to MB

    // Set maxUploadMemoryMB to a fraction of the jsHeapSizeLimit
    maxUploadMemoryMB = jsHeapSizeLimitMB * 0.75; // Use 75% of the total heap size for uploads
    console.log("Max Upload Memory (MB):", maxUploadMemoryMB);
  } else {
    console.log("performance.memory API is not supported in this browser.");
    maxUploadMemoryMB = 2500; // Fallback value
  }

  const maxUploadMemoryBytes = maxUploadMemoryMB * 1024 * 1024; // Convert to bytes

  // Calculate chunkSize dynamically based on the constraints
  const chunkFactor = 0.25; // Fraction of max3DTextureSize to use
  chunkSize = Math.min(
    Math.floor(max3DTextureSize * chunkFactor),
    Math.floor(maxUploadMemoryBytes / 2)
  );
  console.log("Computed chunk size:", chunkSize);
});
//////
/////

/*************** Volume Rendering ********************/
function webGLVolumeRendering(volume_imageData_input, volume_color_val_input) {
  // Assign the input data to the top-level variable
  volume_imageData = volume_imageData_input;
  volume_color_val = volume_color_val_input; // Assign color values
  var container = document.getElementById("viewContainer");
  if (!container) {
    console.error("Container not found.");
    return;
  }
  ////////////////////////////////

  // Create a render window and renderer
  renderWindow = vtk.Rendering.Core.vtkRenderWindow.newInstance();
  renderer = vtk.Rendering.Core.vtkRenderer.newInstance();
  renderWindow.addRenderer(renderer);

  // Create an OpenGL rendering window and link it with the DOM container
  const openglRenderWindow = vtk.Rendering.OpenGL.vtkRenderWindow.newInstance();
  openglRenderWindow.setContainer(container);
  renderWindow.addView(openglRenderWindow);

  // Initialize the interactor
  const interactor = vtk.Rendering.Core.vtkRenderWindowInteractor.newInstance();
  // Correctly link the interactor to the OpenGL render window
  interactor.setView(openglRenderWindow);
  interactor.initialize();
  // ----------------------------------------------------------------------------
  // 2D overlay rendering
  // ----------------------------------------------------------------------------

  const overlaySize = 15;
  const overlayBorder = 2;
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.width = `${overlaySize}px`;
  overlay.style.height = `${overlaySize}px`;
  overlay.style.border = `solid ${overlayBorder}px red`;
  overlay.style.borderRadius = "50%";
  overlay.style.left = "-100px";
  overlay.style.pointerEvents = "none";
  document.querySelector("body").appendChild(overlay);
  // Widget manager setup
  const widgetManager = vtk.Widgets.Core.vtkWidgetManager.newInstance();
  widgetManager.setRenderer(renderer);
  const widget = vtk.Widgets.Widgets3D.vtkImageCroppingWidget.newInstance();

  console.log(widget); // Should log something like vtkImageCroppingWidget

  // ----------------------------------------------------------------------------
  // Widget registration
  // ----------------------------------------------------------------------------
  async function widgetRegistration(e) {
    try {
      const action = e ? e.currentTarget.dataset.action : "addWidget";
      const viewWidget = widgetManager[action](widget);
      if (viewWidget) {
        viewWidget.setDisplayCallback((coords) => {
          overlay.style.left = "-100px";
          if (coords) {
            const [w, h] = openglRenderWindow.getSize();

            overlay.style.left = `${Math.round(
              (coords[0][0] / w) * window.innerWidth -
                overlaySize * 0.5 -
                overlayBorder
            )}px`;
            overlay.style.top = `${Math.round(
              ((h - coords[0][1]) / h) * window.innerHeight -
                overlaySize * 0.5 -
                overlayBorder
            )}px`;
          }
        });

        renderer.resetCamera();
        renderer.resetCameraClippingRange();
      }
      widgetManager.enablePicking();
      renderWindow.render();
    } catch (error) {
      console.error("An error occurred during widget registration:", error);
      // Handle the error appropriately, maybe with an alert or user notification
    }
  }
  // Initial widget register
  widgetRegistration();

  ///////////////////////////////////////////////////////
  const interactorStyle =
    vtk.Interaction.Style.vtkInteractorStyleTrackballCamera.newInstance();
  const vtkColorTransferFunction = vtk.Rendering.Core.vtkColorTransferFunction;
  const vtkCamera = vtk.Rendering.Core.vtkCamera;
  const vtkAnnotatedCubeActor = vtk.Rendering.Core.vtkAnnotatedCubeActor;
  const vtkOrientationMarkerWidget =
    vtk.Interaction.Widgets.vtkOrientationMarkerWidget;

  const vtkMouseCameraTrackballPanManipulator =
    vtk.Interaction.Manipulators.vtkMouseCameraTrackballPanManipulator;
  const vtkMouseCameraTrackballZoomManipulator =
    vtk.Interaction.Manipulators.vtkMouseCameraTrackballZoomManipulator;
  const vtkInteractorStyleManipulator =
    vtk.Interaction.Style.vtkInteractorStyleManipulator;
  const vtkMouseCameraTrackballRotateManipulator =
    vtk.Interaction.Manipulators.vtkMouseCameraTrackballRotateManipulator;

  const { vec3, vec2, quat, mat4 } = glMatrix;
  let lastImageData = volume_imageData[volume_imageData.length - 1]; // Get the last vtkImageData object
  dimen = lastImageData.getDimensions(); // Get the depth (third dimension)
  console.log("dimen: ", dimen);
  ////////////////////////////////////////////////////////////////////////
  container.style.display = "flex";
  container.style.position = "static";
  openglRenderWindow.setContainer(container);
  const { width, height } = container.getBoundingClientRect();
  openglRenderWindow.setSize(width, height);
  renderWindow.addView(openglRenderWindow);

  const viewColors = [
    [0.0, 0.0, 0.0], // sagittal
    [0.0, 0.0, 0.0], // coronal
    [0.0, 0.0, 0.0], // axial
  ];

  function createRGBStringFromRGBValues(rgb) {
    if (rgb.length !== 3) {
      return "rgb(0, 0, 0)";
    }
    return `rgb(${(rgb[0] * 255).toString()}, ${(rgb[1] * 255).toString()}, ${(
      rgb[2] * 255
    ).toString()})`;
  }

  function getCenterOfScene(renderer) {
    const bounds = renderer.computeVisiblePropBounds();
    const center = [0, 0, 0];

    center[0] = (bounds[0] + bounds[1]) / 2.0;
    center[1] = (bounds[2] + bounds[3]) / 2.0;
    center[2] = (bounds[4] + bounds[5]) / 2.0;

    return center;
  }

  const hex2rgba = (hex, alpha = 1) => {
    const [r, g, b] = hex.match(/\w\w/g).map((x) => parseInt(x, 16));
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const HEX_Values = volume_color_val;

  volume_opacity_val = [];
  volume_sample_Distance = [];
  volume_visibility_control = [];
  volume_imageData_obj = volume_imageData;
  ///////
  // Function to calculate cropped dimensions
  function calculateCroppedDimensions(ijkPlanes) {
    const [minI, maxI, minJ, maxJ, minK, maxK] = ijkPlanes;
    croppedDimensions = [
      Math.round(maxI - minI),
      Math.round(maxJ - minJ),
      Math.round(maxK - minK),
    ];
    console.log("Cropped Dimensions:", croppedDimensions);
  }
  //////////////////////////////////////
  // Define getCroppingPlanes outside of the for loop
  // const imageData = vtkImageData.newInstance();
  function getCroppingPlanes(volumeImageData, i, ijkPlanes) {
    // Access the specific imageData using the provided index
    const imageData = volumeImageData[i];
    // console.log("imageData at index ", i, ":", volumeImageData[i]);
    console.log("ijkPlanes:", ijkPlanes);
    // Extract min and max planes from ijkPlanes
    calculateCroppedDimensions(ijkPlanes); // Calculate and set global cropped dimensions

    // // Ensure the imageData object has the necessary method indexToWorld
    // if (!imageData || typeof imageData.indexToWorld !== "function") {
    //   console.error("Invalid imageData: missing indexToWorld method.");
    //   return [];
    // }

    // Define a rotation based on the orientation of the image data
    const rotationMatrix = imageData.getIndexToWorld();
    const rotation = quat.create();
    mat4.getRotation(rotation, rotationMatrix);

    // Helper function to rotate a vector by the given quaternion
    const rotateVec = (vec) => {
      const out = [0, 0, 0];
      vec3.transformQuat(out, vec, rotation);
      return out;
    };

    // Extract min and max planes from ijkPlanes
    const [iMin, iMax, jMin, jMax, kMin, kMax] = ijkPlanes;
    const origin = imageData.indexToWorld([iMin, jMin, kMin]);
    const corner = imageData.indexToWorld([iMax, jMax, kMax]);

    // Return an array of vtkPlane instances with normals oriented based on the image data
    return [
      vtkPlane.newInstance({ normal: rotateVec([1, 0, 0]), origin }), // X-min plane
      vtkPlane.newInstance({ normal: rotateVec([-1, 0, 0]), origin: corner }), // X-max plane
      vtkPlane.newInstance({ normal: rotateVec([0, 1, 0]), origin }), // Y-min plane
      vtkPlane.newInstance({ normal: rotateVec([0, -1, 0]), origin: corner }), // Y-max plane
      vtkPlane.newInstance({ normal: rotateVec([0, 0, 1]), origin }), // Z-min plane
      vtkPlane.newInstance({ normal: rotateVec([0, 0, -1]), origin: corner }), // Z-max plane
    ];
  }
  /////
  ////////////////////////////////
  for (i = 0; i < volume_imageData.length; i++) {
    // Call the Picked Color
    HEX_color_VALUES = HEX_Values[i];

    // Convert Picked Hex color into RGBA string format
    RGB_value = hex2rgba(HEX_color_VALUES);

    // Convert string RBGA to array RGBA
    rgbInt = Array.from(RGB_value.matchAll(/\d+\.?\d*/g), (c) => +c[0]);
    // Define the Volume rendering Functions
    volume_vtk = vtk.Rendering.Core.vtkVolume.newInstance();
    volumeMapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();
    volumeProperty = vtk.Rendering.Core.vtkVolumeProperty.newInstance();
    ofun = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();
    ctfun = vtk.Rendering.Core.vtkColorTransferFunction.newInstance();
    vtkPlane = vtk.Common.DataModel.vtkPlane;
    // Load the Input
    const dataArray =
      volume_imageData[i].getPointData().getScalars() ||
      volume_imageData[i].getPointData().getArrays()[0];
    const dataRange = dataArray.getRange();
    dataRange_1 = volume_imageData[i].getPointData().getScalars().getRange();
    dimensions = volume_imageData[i].getDimensions();
    console.log(volume_imageData[i].getIndexToWorld());

    // Calculating Pixel range
    ii_0 = parseInt(dataRange[0]);
    ii_mid = parseInt(dataRange[1] / 2);
    ii_1 = parseInt(dataRange[1]);

    // Define PieceWise transfer function
    ofun.removeAllPoints();
    ofun.addPoint(ii_0, 0.0);
    ofun.addPoint(ii_1, 1.0);

    min = ii_0;
    max = ii_1;
    temp = 0;

    // Define Color Transfer Function
    ctfun.addRGBPoint(
      rgbInt[3] * 1,
      rgbInt[0] / 256,
      rgbInt[1] / 256,
      rgbInt[2] / 256
    );

    // create color and opacity transfer functions
    volumeProperty.setRGBTransferFunction(0, ctfun);
    volumeProperty.setScalarOpacity(0, ofun);
    volumeProperty.setShade(true);
    volumeProperty.setInterpolationTypeToLinear(); // interpolation: volumeProperty.setInterpolationTypeToFastLinear(); or setInterpolationTypeToLinear(); setInterpolationTypeToNearest();
    volumeProperty.setAmbient(0.2); // Lower for less ambient light
    volumeProperty.setDiffuse(0.7); // Adjust for surface "matte-ness"
    volumeProperty.setSpecular(0.3); // Lower to reduce shininess
    volumeProperty.setSpecularPower(0.8); // Higher values for tighter highlights

    volumeProperty.setOpacityMode(0, 20);
    volumeProperty.setIndependentComponents(true);
    volumeProperty.setUseGradientOpacity(0, true);
    volumeProperty.setGradientOpacityMinimumValue(0, 0);
    volumeProperty.setGradientOpacityMinimumOpacity(0, 0);
    volumeProperty.setGradientOpacityMaximumValue(
      0,
      (dataRange[1] - dataRange[0]) * 0.1
    );
    volumeProperty.setGradientOpacityMaximumOpacity(0, 1.0);

    // set origin of a data to zero
    volume_imageData[i].setOrigin(0.0, 0.0, 0.0);
    image_origin = volume_imageData[i].getOrigin();

    Direction = volume_imageData[i].getDirection();

    img_origin_X = image_origin[0];
    img_origin_Y = image_origin[1];
    img_origin_Z = image_origin[2];

    volumeMapper.setInputData(volume_imageData[i]);
    ///////////

    // update crop widget

    // Update crop widget with the latest image data description
    widget.copyImageDataDescription(volume_imageData[i]);

    const cropState = widget.getWidgetState().getCroppingPlanes();
    ///
    widget.getWidgetState().onModified(() => {
      ijkPlanes = widget.getWidgetState().getCroppingPlanes().getPlanes();
    });
    ///
    cropState.onModified(() => {
      const planes = getCroppingPlanes(
        volume_imageData,
        0,
        cropState.getPlanes()
      );
      // console.log("planes:", planes);
      if (Array.isArray(planes)) {
        volumeMapper.removeAllClippingPlanes();
        planes.forEach((plane) => {
          volumeMapper.addClippingPlane(plane);
        });
        volumeMapper.modified();
      } else {
        console.error("Expected 'planes' to be an array but received:", planes);
      }
    });
    // -----------------------------------------------------------
    // UI control handling
    // -----------------------------------------------------------

    // Assuming your HTML control panel has an ID 'control-panel'
    const controlPanelContainer = document.getElementById("control-panel");

    if (!controlPanelContainer) {
      console.error("Control panel container not found.");
      // Handle the error appropriately
    } else {
      // Function to update flags based on widget interactions
      function updateFlag(e) {
        const value = !!e.target.checked;
        const name = e.currentTarget.dataset.name;
        widget.set({ [name]: value });

        widgetManager.enablePicking();
        renderWindow.render();
      }

      const elems = document.querySelectorAll(".flag");
      for (let i = 0; i < elems.length; i++) {
        elems[i].addEventListener("change", updateFlag);
      }

      const buttons = document.querySelectorAll("button");
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener("click", widgetRegistration);
      }
    }
    /////////////////////

    volumeMapper.setSampleDistance(0.75); // Decrease for higher quality - 0.25
    volumeMapper.setMaximumSamplesPerRay(10000);
    // volumeMapper.setMaximumSamplesPerRay(true); // Set maximum number of samples per ray "true"
    volumeMapper.setAutoAdjustSampleDistances(true);

    // Define vtkVolume
    volume_vtk.setMapper(volumeMapper);
    volume_vtk.setProperty(volumeProperty);

    renderer.addActor(volume_vtk);

    // Create a AXES
    const axes = vtkAnnotatedCubeActor.newInstance();
    axes.setDefaultStyle({
      text: "+X",
      fontStyle: "bold",
      fontFamily: "Arial",
      fontColor: "white",
      faceColor: createRGBStringFromRGBValues(viewColors[0]),
      edgeThickness: 0.1,
      edgeColor: "white",
      resolution: 400,
    });

    axes.setXMinusFaceProperty({
      text: "-X",
      faceColor: createRGBStringFromRGBValues(viewColors[0]),
    });

    axes.setYPlusFaceProperty({
      text: "+Y",
      faceColor: createRGBStringFromRGBValues(viewColors[1]),
    });

    axes.setYMinusFaceProperty({
      text: "-Y",
      faceColor: createRGBStringFromRGBValues(viewColors[1]),
    });

    axes.setZPlusFaceProperty({
      text: "+Z",
      faceColor: createRGBStringFromRGBValues(viewColors[2]),
    });

    axes.setZMinusFaceProperty({
      text: "-Z",
      faceColor: createRGBStringFromRGBValues(viewColors[2]),
    });

    // create orientation widget
    orientationWidget = vtkOrientationMarkerWidget.newInstance({
      actor: axes,
      interactor: interactor,
    });
    setTimeout(() => {
      orientationWidget.setEnabled(true);
      orientationWidget.setViewportCorner(
        vtkOrientationMarkerWidget.Corners.BOTTOM_RIGHT
      );
      orientationWidget.setViewportSize(0.15);
      orientationWidget.setMinPixelSize(20);
      orientationWidget.setMaxPixelSize(80);
    }, 1);

    window.onresize = () => {
      orientationWidget.updateViewport();
    };

    volume_opacity_val[i] = volumeProperty;
    volume_sample_Distance[i] = volumeMapper;
    volume_visibility_control[i] = volume_vtk;
    volume_imageData_obj[i] = volume_imageData[i];
    /////////////////////////////
    // --- Start of the widget setup ---

    // Step 1: Create a container for the vtkPiecewiseGaussianWidget
    if (!document.getElementById("piecewiseGaussianWidgetContainer")) {
      const widgetContainer = document.createElement("div");
      widgetContainer.id = "piecewiseGaussianWidgetContainer";
      widgetContainer.style.position = "absolute";
      widgetContainer.style.bottom = "10px";
      widgetContainer.style.right = "10px";
      widgetContainer.style.width = "400px";
      widgetContainer.style.height = "150px";
      widgetContainer.style.backgroundColor = "white";
      document.body.appendChild(widgetContainer);
    }

    // Step 2: Initialize the vtkPiecewiseGaussianWidget
    const widget1 =
      vtk.Interaction.Widgets.vtkPiecewiseGaussianWidget.newInstance({
        numberOfBins: 256,
        size: [400, 150],
      });
    widget1.setContainer(
      document.getElementById("piecewiseGaussianWidgetContainer")
    );
    widget1.bindMouseListeners();

    // Step 3: Setup data array for the widget
    const histogram = new Float32Array(widget1.getNumberOfBins());
    for (let i = 0; i < dataArray.getNumberOfValues(); i++) {
      const value = dataArray.getValue(i);
      const bin = Math.floor(
        ((value - dataRange[0]) / (dataRange[1] - dataRange[0])) *
          widget1.getNumberOfBins()
      );
      histogram[bin]++;
    }
    widget1.setDataArray(histogram);

    // Step 4: Connect the widget with the volume rendering
    const piecewiseFunction =
      vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();

    // Implementing a more professional lookupTable
    const lookupTable =
      vtk.Rendering.Core.vtkColorTransferFunction.newInstance();

    // Professional color mapping
    lookupTable.addRGBPoint(-1000, 0.0, 0.0, 0.0); // Air: black
    lookupTable.addRGBPoint(-600, 0.3, 0.3, 0.3); // Lung: dark grey
    lookupTable.addRGBPoint(-400, 0.62, 0.36, 0.18); // Fat: brown
    lookupTable.addRGBPoint(0, 0.88, 0.6, 0.29); // Soft Tissue: soft orange
    lookupTable.addRGBPoint(50, 0.95, 0.64, 0.54); // Skin: light pink
    lookupTable.addRGBPoint(150, 1.0, 0.0, 0.0); // Muscle: red
    lookupTable.addRGBPoint(300, 0.0, 1.0, 0.0); // Peripheral Arteries with Contrast: bright green
    lookupTable.addRGBPoint(500, 1.0, 0.94, 0.95); // Fat: off-white
    lookupTable.addRGBPoint(700, 1.0, 1.0, 1.0); // Bone: white
    lookupTable.addRGBPoint(2000, 0.8, 0.8, 0.8); // Dense Bone: light grey

    // Define a detailed opacity mapping
    piecewiseFunction.addPoint(-1000, 0.0); // Air: fully transparent
    piecewiseFunction.addPoint(-600, 0.05); // Lung: slightly more opaque
    piecewiseFunction.addPoint(-400, 0.1); // Fat: slightly opaque
    piecewiseFunction.addPoint(0, 0.2); // Soft Tissue: slightly opaque
    piecewiseFunction.addPoint(50, 0.3); // Skin: more opaque
    piecewiseFunction.addPoint(150, 0.4); // Muscle: more opaque
    piecewiseFunction.addPoint(300, 0.7); // Peripheral Arteries with Contrast: highlight
    piecewiseFunction.addPoint(500, 0.5); // Fat: more opaque
    piecewiseFunction.addPoint(700, 0.85); // Bone: less transparent
    piecewiseFunction.addPoint(2000, 1.0); // Dense Bone: opaque

    widget1.applyOpacity(piecewiseFunction);

    // Apply directly to the volumeProperty of vtkVolume instances
    const volume_vtk_array = [];

    // Inside the loop where you create vtkVolume instances, push each instance to the array
    volume_vtk_array.push(volume_vtk);
    volume_vtk_array.forEach((volume, index) => {
      volume.getProperty().setScalarOpacity(0, piecewiseFunction);
      volume.getProperty().setRGBTransferFunction(0, lookupTable); // Apply the lookup table
    });

    widget1.onOpacityChange(() => {
      widget1.applyOpacity(piecewiseFunction);
      renderWindow.render();
    });

    //////////////////////////
  }
  console.log("checking message1...");

  for (e = 0; e < volume_imageData.length; e++) {
    volume_idOpacity = "#setGradientOpacity" + e;
    volume_idDistance = "#setSampleDistance" + e;
    volume_idblendMode = "#blendMode" + e;
    volume_idVisibility = "#visibility" + e;
    volume_idColor = "#vol_color" + e;
    volume_id_Z_scale = "#Slider_scale" + e;
    volume_id_shade = "#shade" + e;
    volume_id_scalar_opacity = "#setScalarOpacityUnitDistance" + e;
    volume_id_adaptive_resolution = "#setAdaptiveResolution" + e;

    d = e;
    trigger_changes_volume(
      volume_id_scalar_opacity,
      volume_id_adaptive_resolution,
      volume_id_shade,
      volume_idVisibility,
      volume_id_Z_scale,
      volume_visibility_control[d],
      volume_imageData_obj[d],
      volume_idOpacity,
      volume_idDistance,
      volume_opacity_val[d],
      volume_sample_Distance[d],
      renderWindow,
      volume_idblendMode,
      volume_idColor
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////
  const center = getCenterOfScene(renderer);
  const camera = vtkCamera.newInstance();
  // prevent zoom manipulator from messing with our focal point
  camera.getFocalPoint();
  camera.elevation(70);

  renderWindow.addRenderer(renderer);
  interactor.setView(openglRenderWindow);

  //////////////////////////////////
  interactor.initialize();
  interactor.bindEvents(container);

  const PanSelector = vtkMouseCameraTrackballPanManipulator.newInstance({
    button: 3,
  });
  const ZoomSelector = vtkMouseCameraTrackballZoomManipulator.newInstance({
    scrollEnabled: true,
    dragEnabled: false,
  });
  const Rotate = vtkMouseCameraTrackballRotateManipulator.newInstance({
    button: 1,
  });

  const iStyle = vtkInteractorStyleManipulator.newInstance();
  iStyle.addMouseManipulator(PanSelector);
  iStyle.addMouseManipulator(ZoomSelector);
  iStyle.addMouseManipulator(Rotate);
  iStyle.setCenterOfRotation(center);
  renderWindow.getInteractor().setInteractorStyle(iStyle);

  renderer.resetCamera();
  renderer.resetCameraClippingRange();
  volume_vtk.setVisibility(true);

  // Canvas reset
  const Reset_canvas = document.getElementById("Reset_canvas");
  Reset_canvas.addEventListener("click", () => {
    renderer.resetCamera();
    renderWindow.render();
  });
  ////
  // Performance Metrics
  // Performance Metrics
  let frameCount = 0;
  let startTime = performance.now();
  let totalRenderingTime = 0;
  let totalFPS = 0;
  let intervalCount = 0;
  const fpsInterval = 1000; // Measure over one-second intervals
  const maxIntervals = 10; // Number of intervals to average over
  let averageFPS = 0;
  let averageRenderingTime = 0;
  let renderingTimes = []; // Array to hold rendering times for averaging
  let fpsData = []; // Array to store average FPS data for post-processing
  let renderingTimeData = []; // Array to store average rendering time data for post-processing
  let standardDeviationData = []; // Array to store standard deviation of rendering times
  let fpsStandardDeviationData = []; // Array to store standard deviation of FPS

  function measurePerformance() {
    // Start Rendering Time measurement
    const renderStart = performance.now();

    // Render the frame
    renderWindow.render();

    // End Rendering Time measurement
    const renderEnd = performance.now();
    const renderingTime = renderEnd - renderStart;
    totalRenderingTime += renderingTime;
    renderingTimes.push(renderingTime);

    frameCount++;

    const now = performance.now();
    const elapsedTime = now - startTime;

    if (elapsedTime >= fpsInterval) {
      const fps = frameCount / (elapsedTime / 1000);
      const averageRenderingTimeThisInterval =
        renderingTimes.reduce((a, b) => a + b, 0) / renderingTimes.length;
      const renderingTimeStandardDeviation =
        calculateStandardDeviation(renderingTimes);

      totalFPS += fps;
      intervalCount++;

      console.log(`FPS: ${fps.toFixed(2)}`);
      console.log(
        `Average Rendering Time this interval: ${averageRenderingTimeThisInterval.toFixed(
          2
        )} ms`
      );
      console.log(
        `Standard Deviation of Rendering Time: ${renderingTimeStandardDeviation.toFixed(
          2
        )} ms`
      );

      // Store data for post-processing
      fpsData.push(fps);
      renderingTimeData.push(averageRenderingTimeThisInterval);
      standardDeviationData.push(renderingTimeStandardDeviation);

      // Reset counters for this interval
      frameCount = 0;
      totalRenderingTime = 0;
      renderingTimes = [];
      startTime = now;

      // Calculate averages over the fixed number of intervals
      if (intervalCount >= maxIntervals) {
        averageFPS = totalFPS / maxIntervals;
        averageRenderingTime =
          renderingTimeData.reduce((a, b) => a + b, 0) / maxIntervals;
        const averageRenderingTimeStandardDeviation =
          standardDeviationData.reduce((a, b) => a + b, 0) / maxIntervals;
        const averageFPSStandardDeviation = calculateStandardDeviation(fpsData);

        console.log(
          `Average FPS over ${maxIntervals} intervals: ${averageFPS.toFixed(2)}`
        );
        console.log(
          `Average Rendering Time over ${maxIntervals} intervals: ${averageRenderingTime.toFixed(
            2
          )} ms`
        );
        console.log(
          `Average Standard Deviation of Rendering Time over ${maxIntervals} intervals: ${averageRenderingTimeStandardDeviation.toFixed(
            2
          )} ms`
        );
        console.log(
          `Average Standard Deviation of FPS over ${maxIntervals} intervals: ${averageFPSStandardDeviation.toFixed(
            2
          )}`
        );

        // Save the performance data
        savePerformanceData(
          fpsData,
          renderingTimeData,
          standardDeviationData,
          averageFPSStandardDeviation
        );

        // Reset totals and interval count
        totalFPS = 0;
        intervalCount = 0;
        fpsData = [];
        renderingTimeData = [];
        standardDeviationData = [];
      }
    }

    requestAnimationFrame(measurePerformance);
  }

  // Start measuring performance
  requestAnimationFrame(measurePerformance);

  // Utility function to save performance data for further analysis
  function savePerformanceData(
    fpsData,
    renderingTimeData,
    standardDeviationData,
    averageFPSStandardDeviation
  ) {
    const averageFPS = fpsData.reduce((a, b) => a + b, 0) / fpsData.length;
    const averageRenderingTime =
      renderingTimeData.reduce((a, b) => a + b, 0) / renderingTimeData.length;
    const averageStandardDeviation =
      standardDeviationData.reduce((a, b) => a + b, 0) /
      standardDeviationData.length;

    const data = {
      averageFPS,
      averageRenderingTime,
      averageStandardDeviation,
      averageFPSStandardDeviation,
      fpsData,
      renderingTimeData,
      standardDeviationData,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "performanceData.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Function to calculate standard deviation
  function calculateStandardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map((value) => {
      const diff = value - mean;
      return diff * diff;
    });
    const avgSquareDiff =
      squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  // Function to log GPU information
  function logGPUInfo() {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");

    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      console.log(`GPU Vendor: ${vendor}`);
      console.log(`GPU Renderer: ${renderer}`);
    } else {
      console.log("WEBGL_debug_renderer_info extension not supported");
    }

    const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxCombinedTextureImageUnits = gl.getParameter(
      gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS
    );
    const maxVertexTextureImageUnits = gl.getParameter(
      gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS
    );
    const maxCubeMapTextureSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
    const maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    const maxVertexAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    const maxVertexUniformVectors = gl.getParameter(
      gl.MAX_VERTEX_UNIFORM_VECTORS
    );
    const maxVaryingVectors = gl.getParameter(gl.MAX_VARYING_VECTORS);
    const maxFragmentUniformVectors = gl.getParameter(
      gl.MAX_FRAGMENT_UNIFORM_VECTORS
    );
    const max3DTextureSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);

    console.log(`Max Texture Units: ${maxTextureUnits}`);
    console.log(`Max Texture Size: ${maxTextureSize}`);
    console.log(
      `Max Combined Texture Image Units: ${maxCombinedTextureImageUnits}`
    );
    console.log(
      `Max Vertex Texture Image Units: ${maxVertexTextureImageUnits}`
    );
    console.log(`Max Cube Map Texture Size: ${maxCubeMapTextureSize}`);
    console.log(`Max Render Buffer Size: ${maxRenderBufferSize}`);
    console.log(`Max Vertex Attributes: ${maxVertexAttributes}`);
    console.log(`Max Vertex Uniform Vectors: ${maxVertexUniformVectors}`);
    console.log(`Max Varying Vectors: ${maxVaryingVectors}`);
    console.log(`Max Fragment Uniform Vectors: ${maxFragmentUniformVectors}`);
    console.log(`Max 3D Texture Size: ${max3DTextureSize}`);
  }

  logGPUInfo();
}

// function to convert HEX to RGBA string
const hex2rgba = (hex, alpha = 1) => {
  const [r, g, b] = hex.match(/\w\w/g).map((x) => parseInt(x, 16));
  return `rgba(${r},${g},${b},${alpha})`;
};
console.log("checking message2...");

// function to trigger switches
function trigger_changes_volume(
  volume_id_scalar_opacity,
  volume_id_adaptive_resolution,
  volume_id_shade,
  volume_idVisibility,
  volume_id_Z_scale,
  volume_visibility_control,
  volume_imageData_obj,
  volume_idOpacity,
  volume_idDistance,
  volume_opacity_val,
  volume_sample_Distance,
  renderWindow,
  volume_idblendMode,
  volume_idColor
) {
  // Control Gradient Opacity
  $(volume_idOpacity).change(function () {
    newVal_OPA = this.value;
    console.log("Gradient Opacity:", newVal_OPA);
    volume_opacity_val.setGradientOpacityMaximumOpacity(0, newVal_OPA); // Gradient
    renderWindow.render();
  });
  // Scalar opacity
  $(volume_id_scalar_opacity).change(function () {
    const scalarOpacityValue = parseFloat(this.value);

    const scalarOpacityTransferFunction = volume_opacity_val.getScalarOpacity();
    scalarOpacityTransferFunction.removeAllPoints();

    scalarOpacityTransferFunction.addPoint(0, 0.0);
    scalarOpacityTransferFunction.addPoint(scalarOpacityValue / 2, 0.5);
    scalarOpacityTransferFunction.addPoint(scalarOpacityValue, 1.0);
    scalarOpacityTransferFunction.addPoint(
      scalarOpacityValue + (255 - scalarOpacityValue) / 2,
      0.5
    );
    scalarOpacityTransferFunction.addPoint(255, 0.2);

    renderWindow.render();
    console.log("Updated Scalar Opacity to:", scalarOpacityValue);
  });
  console.log("checking message3...");

  /// Apply cropped and rerender this part
  $(volume_id_adaptive_resolution).change(function () {
    const adaptiveResolutionValue = parseInt(this.value);
    if (adaptiveResolutionValue === 255) {
      // Ceil the ijkPlanes values
      const ceiledIjkPlanes = ijkPlanes.map(Math.floor);

      console.log("Original ijkPlanes (Ceiled):", ceiledIjkPlanes);

      // Render the cropped region with original resolution and spacing
      replaceCroppedRegionWithOriginalResolution(
        combinedImage1,
        ceiledIjkPlanes
      );
    }
  });

  function replaceCroppedRegionWithOriginalResolution(
    combinedImage1,
    ijkPlanes
  ) {
    // Store the current camera settings
    const cameraSettings = storeCameraSettings(renderer);
    const [iMin, iMax, jMin, jMax, kMin, kMax] = ijkPlanes;

    console.log("ijkPlanes:", ijkPlanes);
    console.log("combinedImage1:", combinedImage1);
    console.log("itkImages:", itkImages);

    // Use global variables for original and downsampled dimensions
    const originalSize = combinedDimensions; // Size of the combined image
    const downsampledSize = volImgDimensions; // Size of the downsampled image

    // Calculate the downsample factor for each dimension
    const downsampleFactor = [
      originalSize[0] / downsampledSize[0],
      originalSize[1] / downsampledSize[1],
      originalSize[2] / downsampledSize[2],
    ];

    let vtkImageData = convertItkToVtkImage(combinedImage1);
    console.log("Original resolution part vtkImageData:", vtkImageData);

    const originalData = combinedImage1.data;
    const spacing = vtkImageData.getSpacing();
    const origin = vtkImageData.getOrigin();
    const direction = vtkImageData.getDirection();

    console.log("Original dimensions:", originalSize);
    console.log("Downsampled dimensions:", downsampledSize);
    console.log("Original spacing:", spacing);
    console.log("Original origin:", origin);
    console.log("Original direction:", direction);

    // Ensure indices are within bounds and scaled for downsampling
    const validIMin = Math.max(0, Math.floor(iMin * downsampleFactor[0]));
    const validIMax = Math.min(
      originalSize[0] - 1,
      Math.floor(iMax * downsampleFactor[0])
    );
    const validJMin = Math.max(0, Math.floor(jMin * downsampleFactor[1]));
    const validJMax = Math.min(
      originalSize[1] - 1,
      Math.floor(jMax * downsampleFactor[1])
    );
    const validKMin = Math.max(0, Math.floor(kMin * downsampleFactor[2]));
    const validKMax = Math.min(
      originalSize[2] - 1,
      Math.floor(kMax * downsampleFactor[2])
    );

    // Calculate sub-volume dimensions based on the valid indices
    let subVolumeDimensions = [
      validIMax - validIMin + 1,
      validJMax - validJMin + 1,
      validKMax - validKMin + 1,
    ];

    let subVolumeData = new Int16Array(
      subVolumeDimensions[0] * subVolumeDimensions[1] * subVolumeDimensions[2]
    );

    // Crop the relevant region from the original data
    for (let k = validKMin; k <= validKMax; k++) {
      for (let j = validJMin; j <= validJMax; j++) {
        for (let i = validIMin; i <= validIMax; i++) {
          const subVolumeIndex =
            (k - validKMin) * subVolumeDimensions[0] * subVolumeDimensions[1] +
            (j - validJMin) * subVolumeDimensions[0] +
            (i - validIMin);
          const originalIndex =
            k * originalSize[0] * originalSize[1] + j * originalSize[0] + i;
          subVolumeData[subVolumeIndex] = originalData[originalIndex];
        }
      }
    }

    // Create vtkSubVolume with the original data
    const vtkSubVolume = vtk.Common.DataModel.vtkImageData.newInstance();
    vtkSubVolume.setDimensions(subVolumeDimensions);
    vtkSubVolume.setSpacing(spacing);
    vtkSubVolume.setOrigin(origin);
    vtkSubVolume.setDirection(direction);
    vtkSubVolume.getPointData().setScalars(
      vtk.Common.Core.vtkDataArray.newInstance({
        values: subVolumeData,
        numberOfComponents: 1,
        dataType: vtk.Common.Core.vtkDataArray.VTK_SHORT,
      })
    );

    console.log("vtkSubVolume dimensions:", vtkSubVolume.getDimensions());
    console.log("vtkSubVolume origin:", vtkSubVolume.getOrigin());
    console.log("vtkSubVolume spacing:", vtkSubVolume.getSpacing());

    // Extract the corresponding part of the original data for comparison
    const originalSubVolumeData = new Int16Array(
      subVolumeDimensions[0] * subVolumeDimensions[1] * subVolumeDimensions[2]
    );

    for (let k = validKMin; k <= validKMax; k++) {
      for (let j = validJMin; j <= validJMax; j++) {
        for (let i = validIMin; i <= validIMax; i++) {
          const originalIndex =
            k * originalSize[0] * originalSize[1] + j * originalSize[0] + i;
          const subVolumeIndex =
            (k - validKMin) * subVolumeDimensions[0] * subVolumeDimensions[1] +
            (j - validJMin) * subVolumeDimensions[0] +
            (i - validIMin);
          originalSubVolumeData[subVolumeIndex] = originalData[originalIndex];
        }
      }
    }

    // Compare the original sub-volume data with vtkSubVolume data
    if (
      arraysEqual(subVolumeData, originalSubVolumeData) &&
      arraysEqual(vtkSubVolume.getDimensions(), subVolumeDimensions) &&
      arraysEqual(vtkSubVolume.getSpacing(), spacing) &&
      arraysEqual(vtkSubVolume.getOrigin(), origin) &&
      arraysEqual(vtkSubVolume.getDirection(), direction)
    ) {
      console.log(
        "vtkSubVolume matches the corresponding part of the original data."
      );
    } else {
      console.log(
        "vtkSubVolume does not match the corresponding part of the original data."
      );
    }
    console.log("vtkSubVolume:", vtkSubVolume);
    console.log("originalSubVolumeData:", originalSubVolumeData);

    webGLVolumeRendering([vtkSubVolume], volume_color_val);

    // Restore the camera settings after rendering
    restoreCameraSettings(renderer, cameraSettings);
    // Adjust the camera to fit the new bounds
    renderer.resetCamera();
    renderer.resetCameraClippingRange();
    renderWindow.render();
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  // Function to store camera settings
  function storeCameraSettings(renderer) {
    const camera = renderer.getActiveCamera();
    return {
      position: camera.getPosition(),
      focalPoint: camera.getFocalPoint(),
      viewUp: camera.getViewUp(),
    };
  }

  // Function to restore camera settings
  function restoreCameraSettings(renderer, settings) {
    const camera = renderer.getActiveCamera();
    camera.setPosition(...settings.position);
    camera.setFocalPoint(...settings.focalPoint);
    camera.setViewUp(...settings.viewUp);
    renderer.resetCameraClippingRange();
  }

  // Control Sample Distance
  $(volume_idDistance).change(function () {
    new_Val_SD = this.value;
    console.log("Sample Distance:", new_Val_SD);
    volume_sample_Distance.setSampleDistance(new_Val_SD);
    renderWindow.render();
  });

  // Control Blending Mode
  $(volume_idblendMode).change(function () {
    new_Val_blen = parseInt(this.value, 10);
    volume_sample_Distance.setBlendMode(new_Val_blen);
    renderWindow.render();
  });

  // Control Image Visibility
  var VIS = false;
  $(volume_idVisibility).on("click", function () {
    volume_visibility_control.setVisibility(VIS);
    renderWindow.render();
    VIS = !VIS;
  });

  // Control Image Shade
  var SHADE = false;
  $(volume_id_shade).on("click", function () {
    volume_opacity_val.setShade(SHADE);
    renderWindow.render();
    SHADE = !SHADE;
  });

  // Control the color of the image
  const colorTFun = ctfun;
  const vol_colorChange = document.querySelector(volume_idColor);

  vol_colorChange.addEventListener("input", (e) => {
    volumeColor = hex2rgba(e.target.value);
    rgba2Int = Array.from(volumeColor.matchAll(/\d+\.?\d*/g), (c) => +c[0]);
    colorTFun.addRGBPoint(
      rgba2Int[3] * 1,
      rgba2Int[0] / 256,
      rgba2Int[1] / 256,
      rgba2Int[2] / 256
    );
    volume_opacity_val.setRGBTransferFunction(0, colorTFun);
    renderWindow.render();
  });

  // Control the Z-SCALE of each volume
  extent = volume_imageData_obj.getExtent();
  const sizeZ = extent[5];
  img_origin_Z = 0;

  $(volume_id_Z_scale).change(function () {
    newVal = this.value;
    console.log(newVal);
    volume_visibility_control.setScale(1.0, 1.0, newVal);

    el = document.querySelector(".planePositionZ");
    el.setAttribute("min", -sizeZ * newVal + img_origin_Z);
    el.setAttribute("max", img_origin_Z);
    el.setAttribute("value", -sizeZ * newVal + img_origin_Z);

    el = document.querySelector(".planePositionZ_inv");
    el.setAttribute("min", img_origin_Z);
    el.setAttribute("max", sizeZ * newVal + img_origin_Z);
    el.setAttribute("value", img_origin_Z);

    renderWindow.render();
  });
}

/***** Callback function for Volume rendering *************************/
// Modify vol_process to store originalSize before downsampling
function vol_process(vol_arrFileList, vol_color_val) {
  let vol_img = [];
  let processingFailed = false;
  let originalDim, vtkImageDataOrg;
  let totalChunks = 0;
  let processedChunks = 0;

  // Function to log memory usage in MB
  function logMemoryUsage(label) {
    if (performance.memory) {
      const memory = performance.memory;
      const jsHeapSizeLimitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(
        2
      );
      const totalJSHeapSizeMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(
        2
      );
      const usedJSHeapSizeMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);

      console.log(`${label} - JS Heap Size Limit: ${jsHeapSizeLimitMB} MB`);
      console.log(`${label} - Total JS Heap Size: ${totalJSHeapSizeMB} MB`);
      console.log(`${label} - Used JS Heap Size: ${usedJSHeapSizeMB} MB`);
    } else {
      console.log(
        `${label} - performance.memory API is not supported in this browser.`
      );
    }
  }

  // Initial Memory Usage
  logMemoryUsage("Initial");

  // Convert FileList to array if necessary
  const filesArray = Array.isArray(vol_arrFileList)
    ? vol_arrFileList
    : Array.from(vol_arrFileList);

  // Calculate the total number of chunks
  filesArray.forEach((file) => {
    const fileExtension = file[0].webkitRelativePath.slice(-4).toLowerCase();
    const isDicom = fileExtension === ".dcm";
    const isNifti = fileExtension === ".nii";
    const isSingleFile = file.length === 1;

    if (isDicom || isNifti || !isSingleFile) {
      totalChunks += Math.ceil(file.length / chunkSize);
    } else {
      totalChunks += 1; // Single file is one chunk
    }
  });

  console.log(`Total chunks to process: ${totalChunks}`);

  filesArray.forEach((file) => {
    const fileExtension = file[0].webkitRelativePath.slice(-4).toLowerCase();
    const isDicom = fileExtension === ".dcm";
    const isNifti = fileExtension === ".nii";
    const isSingleFile = file.length === 1;

    const processImageData = ({ image: itkImage, webWorker }) => {
      if (webWorker) webWorker.terminate();
      originalDim = itkImage.size;
      console.log("originalDim dimensions:", originalDim);
      vtkImageDataOrg = convertItkToVtkImage(itkImage);
      console.log("vtkImageDataOrg:", vtkImageDataOrg);

      // Store original size before any downsampling
      itkImage.originalSize = itkImage.size.slice();

      // Process image chunks and store in itkImages
      streamingImageChunks(itkImage, max3DTextureSize)
        .then((processedChunksArray) => {
          itkImages.push(...processedChunksArray);
          processedChunks += processedChunksArray.length;
          console.log(`Processed chunks: ${processedChunks}/${totalChunks}`);
          logMemoryUsage(`After processing chunk ${processedChunks}`);

          if (processedChunks === totalChunks) {
            combineAndRender(itkImages);
          }
        })
        .catch((error) => {
          console.error("Error processing image chunks: ", error);
          processingFailed = true;
        });
    };

    const handleError = (error) => {
      console.error("Error processing files: ", error);
      processingFailed = true;
    };

    let promise;
    if (isDicom) {
      promise = new Promise((resolve, reject) => {
        readDicomInChunks(
          file,
          chunkSize,
          (result) => {
            processImageData(result);
            resolve();
          },
          reject
        );
      });
    } else if (isNifti) {
      promise = new Promise((resolve, reject) => {
        readNiftiInChunks(
          file,
          chunkSize,
          (result) => {
            processImageData(result);
            resolve();
          },
          reject
        );
      });
    } else if (!isSingleFile) {
      promise = itk
        .readImageFileSeries(file, 1.0, 0.0)
        .then(processImageData)
        .catch(handleError);
    } else {
      promise = itk
        .readImageFile(null, file[0])
        .then(processImageData)
        .catch(handleError);
    }
  });

  function combineAndRender(itkImages) {
    if (!processingFailed) {
      combinedImage1 = combineChunks(itkImages);
      console.log("combinedImage1:", combinedImage1);
      let combinedImage = combinedImage1;

      // Downsample combined image if needed
      if (
        combinedImage1.size.some((dim) => dim > max3DTextureSize / totalChunks)
      ) {
        combinedImage = downsampleImage(combinedImage1, max3DTextureSize / 2);
      }

      const vtkImageData = convertItkToVtkImage(combinedImage);
      vol_img.push(vtkImageData);

      // Log the dimensions of vol_img
      volImgDimensions = vtkImageData.getDimensions();
      console.log("vol_img dimensions:", volImgDimensions);

      $("#loading").hide();
      webGLVolumeRendering(vol_img, vol_color_val);

      // Final Memory Usage
      logMemoryUsage("Final");
    }
  }

  function streamingImageChunks(itkImage, max3DTextureSize) {
    return new Promise((resolve, reject) => {
      const { size, spacing, data } = itkImage;
      const [width, height, depth] = size;
      const maxChunks = Math.ceil(depth / chunkSize);
      const chunks = [];

      try {
        for (let i = 0; i < maxChunks; i++) {
          const zStart = i * chunkSize;
          const zEnd = Math.min((i + 1) * chunkSize, depth);
          const chunkDepth = zEnd - zStart;

          const chunkData = new Int16Array(width * height * chunkDepth);

          for (let z = zStart; z < zEnd; z++) {
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const index = z * width * height + y * width + x;
                const chunkIndex =
                  (z - zStart) * width * height + y * width + x;
                chunkData[chunkIndex] = data[index];
              }
            }
          }

          chunks.push({
            ...itkImage,
            size: [width, height, chunkDepth],
            data: chunkData,
          });
        }

        // Reverse the order of chunks to combine from bottom to top
        chunks.reverse();

        resolve(chunks);
      } catch (error) {
        reject(error);
      }
    });
  }

  function downsampleImage(itkImage, targetMaxDimension) {
    const { size, spacing, data } = itkImage;
    const maxFactor = Math.max(...size.map((dim) => dim / targetMaxDimension));
    if (maxFactor <= 1) return itkImage;

    const newSize = size.map((dim) => Math.ceil(dim / maxFactor));
    const newSpacing = spacing.map((s) => s * maxFactor);
    const newPixelData = new Int16Array(newSize.reduce((a, b) => a * b));

    for (let z = 0; z < newSize[2]; z++) {
      for (let y = 0; y < newSize[1]; y++) {
        for (let x = 0; x < newSize[0]; x++) {
          const originalX = x * maxFactor;
          const originalY = y * maxFactor;
          const originalZ = z * maxFactor;

          const x0 = Math.floor(originalX);
          const x1 = Math.min(size[0] - 1, x0 + 1);
          const y0 = Math.floor(originalY);
          const y1 = Math.min(size[1] - 1, y0 + 1);
          const z0 = Math.floor(originalZ);
          const z1 = Math.min(size[2] - 1, z0 + 1);

          const alphaX = originalX - x0;
          const alphaY = originalY - y0;
          const alphaZ = originalZ - z0;

          const v000 = data[z0 * size[1] * size[0] + y0 * size[0] + x0];
          const v001 = data[z0 * size[1] * size[0] + y0 * size[0] + x1];
          const v010 = data[z0 * size[1] * size[0] + y1 * size[0] + x0];
          const v011 = data[z0 * size[1] * size[0] + y1 * size[0] + x1];
          const v100 = data[z1 * size[1] * size[0] + y0 * size[0] + x0];
          const v101 = data[z1 * size[1] * size[0] + y0 * size[0] + x1];
          const v110 = data[z1 * size[1] * size[0] + y1 * size[0] + x0];
          const v111 = data[z1 * size[1] * size[0] + y1 * size[0] + x1];

          const v00 = linearInterpolate(v000, v001, alphaX);
          const v01 = linearInterpolate(v010, v011, alphaX);
          const v10 = linearInterpolate(v100, v101, alphaX);
          const v11 = linearInterpolate(v110, v111, alphaX);

          const v0 = linearInterpolate(v00, v01, alphaY);
          const v1 = linearInterpolate(v10, v11, alphaY);

          const v = linearInterpolate(v0, v1, alphaZ);

          newPixelData[z * newSize[1] * newSize[0] + y * newSize[0] + x] = v;
        }
      }
    }

    return {
      ...itkImage,
      size: newSize,
      spacing: newSpacing,
      data: newPixelData,
    };
  }

  function linearInterpolate(c0, c1, alpha) {
    return c0 * (1 - alpha) + c1 * alpha;
  }

  function readDicomInChunks(files, chunkSize, processImageData, handleError) {
    let totalFiles = files.length;
    let chunks = [];

    for (let i = 0; i < totalFiles; i += chunkSize) {
      chunks.push(Array.from(files).slice(i, i + chunkSize));
    }

    (function processNextChunk() {
      if (chunks.length === 0) return;

      let currentChunk = chunks.shift();
      itk
        .readImageDICOMFileSeries(currentChunk)
        .then((result) => {
          processImageData(result);
          processNextChunk();
        })
        .catch(handleError);
    })();
  }

  function readNiftiInChunks(file, chunkSize, processImageData, handleError) {
    // Assuming NIfTI file is single, this needs to be handled differently if multi-file
    itk.readImageFile(null, file[0]).then(processImageData).catch(handleError);
  }

  function combineChunks(itkImages) {
    if (itkImages.length === 0) return null;

    // Assume all images have the same width and height
    const { size, spacing, data: firstData } = itkImages[0];
    const [width, height] = size;
    let totalDepth = 0;

    itkImages.forEach((image) => {
      totalDepth += image.size[2];
    });

    const combinedData = new Int16Array(width * height * totalDepth);
    let offset = 0;

    // Reverse the order of itkImages to combine from bottom to top
    itkImages.reverse().forEach((image) => {
      const { data } = image;
      combinedData.set(data, offset);
      offset += data.length;
    });

    // Check dimensions of the combined data
    combinedDimensions = [width, height, totalDepth];
    console.log("Dimensions of the combined data:", combinedDimensions);

    return {
      ...itkImages[0],
      size: [width, height, totalDepth],
      data: combinedData,
    };
  }
}
///////////////////////////
