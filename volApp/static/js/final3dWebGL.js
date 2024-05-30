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

document.addEventListener("DOMContentLoaded", function () {
  // Create a canvas element to obtain a WebGL context
  const canvas = document.createElement("canvas");
  // Attempt to get a WebGL 2.0 context
  const gl = canvas.getContext("webgl2");

  if (!gl) {
    console.error("WebGL 2 is not supported by your browser.");
    return;
  }

  // Query the maximum 3D texture size allowed by WebGL 2.0
  max3DTextureSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
  console.log("Maximum 3D texture size:", max3DTextureSize);
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
  const renderWindow = vtk.Rendering.Core.vtkRenderWindow.newInstance();
  const renderer = vtk.Rendering.Core.vtkRenderer.newInstance();
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
  // Record the start time for performance measurement
  renderWindow.render();
  volume_vtk.setVisibility(true);

  // Canvas reset
  const Reset_canvas = document.getElementById("Reset_canvas");
  Reset_canvas.addEventListener("click", () => {
    renderer.resetCamera();
    renderWindow.render();
  });
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
      replaceCroppedRegionWithOriginalResolution(itkImages, ceiledIjkPlanes);
    }
  });

  function replaceCroppedRegionWithOriginalResolution(itkImages, ijkPlanes) {
    const [iMin, iMax, jMin, jMax, kMin, kMax] = ijkPlanes;

    console.log("ijkPlanes:", ijkPlanes);

    const originalResolutionImages = itkImages.map((itkImage) => {
      const originalSize = itkImage.originalSize || itkImage.size;
      let vtkImageData = convertItkToVtkImage(itkImage);
      console.log("Original resolution part vtkImageData:", vtkImageData);

      const dimensions = vtkImageData.getDimensions();
      const spacing = vtkImageData.getSpacing();
      const origin = vtkImageData.getOrigin();
      const direction = vtkImageData.getDirection();
      const originalData = vtkImageData.getPointData().getScalars().getData();

      console.log("Original dimensions:", originalSize);
      console.log("Original spacing:", spacing);
      console.log("Original origin:", origin);
      console.log("Original direction:", direction);

      // Ensure indices are within bounds
      const validIMin = Math.max(0, iMin);
      const validIMax = Math.min(originalSize[0] - 1, iMax);
      const validJMin = Math.max(0, jMin);
      const validJMax = Math.min(originalSize[1] - 1, jMax);
      const validKMin = Math.max(0, kMin);
      const validKMax = Math.min(originalSize[2] - 1, kMax);

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
              (k - validKMin) *
                subVolumeDimensions[0] *
                subVolumeDimensions[1] +
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
              (k - validKMin) *
                subVolumeDimensions[0] *
                subVolumeDimensions[1] +
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

      return vtkSubVolume;
    });

    webGLVolumeRendering(originalResolutionImages, volume_color_val);
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
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
function vol_process(vol_arrFileList, vol_color_val) {
  let vol_img = [];
  let processedCount = 0;
  let processingFailed = false;

  vol_arrFileList.forEach((file, index) => {
    let fileExtension = file[0].webkitRelativePath.slice(-4).toLowerCase();
    let isDicom = fileExtension === ".dcm";
    let isNifti = fileExtension === ".nii";
    let isSingleFile = file.length === 1;

    const processImageData = ({ image: itkImage, webWorker }) => {
      if (webWorker) webWorker.terminate();
      originalDim = itkImage.size;
      console.log("originalDim dimensions:", originalDim);
      vtkImageDataOrg = convertItkToVtkImage(itkImage);
      console.log("vtkImageDataOrg:", vtkImageDataOrg);

      // Store original size before any downsampling
      itkImage.originalSize = itkImage.size.slice();

      // Apply streaming filter and downsample if needed
      itkImage = streamingImageFilter(itkImage, max3DTextureSize);
      console.log("streamingImageFilter dimensions:", itkImage.size);
      console.log("original data :", itkImage);
      // Store itkImage in the global array
      itkImages.push(itkImage);
      console.log("global data :", itkImages);

      if (itkImage.size.some((dim) => dim > max3DTextureSize / 8)) {
        itkImage = downsampleImage(itkImage, max3DTextureSize / 1);
      }
      downsampledDim = itkImage.size;
      console.log("downsampleImage dimensions:", downsampledDim);
      //////////// ///////////////// //////////////////

      // itkImage = volumeCleaning(itkImage);
      // console.log("volumeCleaning dimensions:", itkImage.size);

      let vtkImageData = convertItkToVtkImage(itkImage);
      vol_img.push(vtkImageData);

      checkAllFilesProcessed();
    };

    const handleError = (error) => {
      console.error("Error processing files: ", error);
      processingFailed = true;
      checkAllFilesProcessed();
    };

    if (isDicom) {
      itk
        .readImageDICOMFileSeries(file)
        .then(processImageData)
        .catch(handleError);
    } else if (isNifti) {
      itk
        .readImageFile(null, file[0])
        .then(processImageData)
        .catch(handleError);
    } else if (!isSingleFile) {
      itk
        .readImageFileSeries(file, 1.0, 0.0)
        .then(processImageData)
        .catch(handleError);
    } else {
      itk
        .readImageFile(null, file[0])
        .then(processImageData)
        .catch(handleError);
    }
  });

  function checkAllFilesProcessed() {
    processedCount++;
    if (processedCount === vol_arrFileList.length) {
      $("#loading").hide();
      if (!processingFailed) {
        try {
          webGLVolumeRendering(vol_img, vol_color_val);
        } catch (error) {
          console.error("Error in webGLVolumeRendering:", error);
        }
      }
    }
  }
  // Implementing a streaming image filter
  function streamingImageFilter(itkImage, max3DTextureSize) {
    const { size, spacing, data } = itkImage;

    // Determine the divisor for chunk size dynamically based on max3DTextureSize
    const divisor = Math.ceil(max3DTextureSize / 512); // Adjust 512 based on the hardware capabilities
    console.log(`divisor: ${divisor}`);
    // Determine chunk size as a part of the z-dimension, making it dynamic
    const chunkSize = Math.max(1, Math.floor(size[2] / divisor)); // depends on max3DTextureSize

    console.log(`chunkSize: ${chunkSize}`);
    console.log("streaming function dimensions:", size);

    const processedData = new Int16Array(data.length);

    // Calculate the number of chunks along each dimension
    const chunks = size.map((dim) => Math.ceil(dim / chunkSize));

    // Define processing for a single chunk
    const processChunk = (xStart, xEnd, yStart, yEnd, zStart, zEnd) => {
      for (let zi = zStart; zi < zEnd; zi++) {
        for (let yi = yStart; yi < yEnd; yi++) {
          for (let xi = xStart; xi < xEnd; xi++) {
            const index = zi * size[1] * size[0] + yi * size[0] + xi;
            processedData[index] = data[index] * 1; // Apply a simple scaling factor
          }
        }
      }
      console.log("processedData dimensions:", processedData.size);
    };

    // Process each chunk
    for (let z = 0; z < chunks[2]; z++) {
      for (let y = 0; y < chunks[1]; y++) {
        for (let x = 0; x < chunks[0]; x++) {
          const xStart = x * chunkSize;
          const xEnd = Math.min(xStart + chunkSize, size[0]);
          const yStart = y * chunkSize;
          const yEnd = Math.min(yStart + chunkSize, size[1]);
          const zStart = z * chunkSize;
          const zEnd = Math.min(zStart + chunkSize, size[2]);

          processChunk(xStart, xEnd, yStart, yEnd, zStart, zEnd);
        }
      }
    }

    // Return a new itkImage object with the processed data
    return {
      ...itkImage,
      data: processedData,
    };
  }

  //////////////////
  function linearInterpolate(c0, c1, alpha) {
    return c0 * (1 - alpha) + c1 * alpha;
  }

  function downsampleImage(itkImage, targetMaxDimension) {
    const { size, spacing, data } = itkImage;
    console.log("Original size for downsampling:", size); // Print original size before downsampling

    // Calculate downsample factors for each dimension
    const downsampleFactors = size.map((dim) => dim / targetMaxDimension);

    // Find the maximum downsample factor to keep the aspect ratio
    const maxFactor = Math.max(...downsampleFactors);

    // Early exit if no downsampling is needed
    if (maxFactor <= 1) {
      return itkImage;
    }

    // Calculate new size and spacing
    const newSize = size.map((dim) => Math.ceil(dim / maxFactor));
    const newSpacing = spacing.map((s, i) => s * maxFactor);
    console.log("New size after downsampling:", newSize); // Print new size after downsampling

    // Allocate a new buffer for the downsampled data
    const numberOfPixels = newSize.reduce((a, b) => a * b, 1);
    const newPixelData = new Int16Array(numberOfPixels);

    // Downsample each dimension
    for (let z = 0; z < newSize[2]; z++) {
      for (let y = 0; y < newSize[1]; y++) {
        for (let x = 0; x < newSize[0]; x++) {
          // Find the corresponding position in the original data
          const originalX = x * maxFactor;
          const originalY = y * maxFactor;
          const originalZ = z * maxFactor;

          // Compute indices for linear interpolation
          const x0 = Math.floor(originalX);
          const x1 = Math.min(size[0] - 1, x0 + 1);
          const y0 = Math.floor(originalY);
          const y1 = Math.min(size[1] - 1, y0 + 1);
          const z0 = Math.floor(originalZ);
          const z1 = Math.min(size[2] - 1, z0 + 1);

          // Calculate the weights for the interpolation
          const alphaX = originalX - x0;
          const alphaY = originalY - y0;
          const alphaZ = originalZ - z0;

          // Perform linear interpolation
          const v000 = data[z0 * size[1] * size[0] + y0 * size[0] + x0];
          const v001 = data[z0 * size[1] * size[0] + y0 * size[0] + x1];
          const v010 = data[z0 * size[1] * size[0] + y1 * size[0] + x0];
          const v011 = data[z0 * size[1] * size[0] + y1 * size[0] + x1];
          const v100 = data[z1 * size[1] * size[0] + y0 * size[0] + x0];
          const v101 = data[z1 * size[1] * size[0] + y0 * size[0] + x1];
          const v110 = data[z1 * size[1] * size[0] + y1 * size[0] + x0];
          const v111 = data[z1 * size[1] * size[0] + y1 * size[0] + x1];

          // Interpolate along x
          const v00 = linearInterpolate(v000, v001, alphaX);
          const v01 = linearInterpolate(v010, v011, alphaX);
          const v10 = linearInterpolate(v100, v101, alphaX);
          const v11 = linearInterpolate(v110, v111, alphaX);

          // Interpolate along y
          const v0 = linearInterpolate(v00, v01, alphaY);
          const v1 = linearInterpolate(v10, v11, alphaY);

          // Interpolate along z
          const v = linearInterpolate(v0, v1, alphaZ);

          // Assign to the new data
          newPixelData[z * newSize[1] * newSize[0] + y * newSize[0] + x] = v;
        }
      }
    }

    // Create and return the new itkImage object
    return {
      ...itkImage,
      size: newSize,
      spacing: newSpacing,
      data: newPixelData,
    };
  }

  //implementation of the volumeCleaning function
  /*
  function volumeCleaning(itkImage) {
    const { size, data } = itkImage;

    // Thresholding to identify non-zero voxels
    const threshold = -80; // Adjust threshold if needed
    const binaryMask = new Int16Array(size[0] * size[1] * size[2]);
    for (let i = 0; i < data.length; i++) {
      if (data[i] > threshold) {
        binaryMask[i] = 1;
      }
    }

    // Run connected component labeling to find the largest connected component
    const { labels } = connectedComponentLabeling(binaryMask, size);

    // Find the label of the largest connected component
    const labelCounts = new Map();
    let maxLabel = 0;
    for (const label of labels) {
      if (label !== 0) {
        const count = labelCounts.get(label) || 0;
        labelCounts.set(label, count + 1);
        if (count + 1 > (labelCounts.get(maxLabel) || 0)) {
          maxLabel = label;
        }
      }
    }

    // Find bounding box of the largest connected component
    let minX = size[0];
    let maxX = 0;
    let minY = size[1];
    let maxY = 0;
    let minZ = size[2];
    let maxZ = 0;
    for (let z = 0; z < size[2]; z++) {
      for (let y = 0; y < size[1]; y++) {
        for (let x = 0; x < size[0]; x++) {
          const idx = x + y * size[0] + z * size[0] * size[1];
          if (labels[idx] === maxLabel) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
          }
        }
      }
    }

    // Add padding to the bounding box (optional)
    const padding = 0; // Adjust padding size if needed
    minX = Math.max(0, minX - padding);
    maxX = Math.min(size[0] - 1, maxX + padding);
    minY = Math.max(0, minY - padding);
    maxY = Math.min(size[1] - 1, maxY + padding);
    minZ = Math.max(0, minZ - padding);
    maxZ = Math.min(size[2] - 1, maxZ + padding);

    // Crop the image based on the bounding box
    const newSize = [maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1];
    const croppedData = new Int16Array(newSize[0] * newSize[1] * newSize[2]);
    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const srcIdx = x + y * size[0] + z * size[0] * size[1];
          const dstIdx =
            x -
            minX +
            (y - minY) * newSize[0] +
            (z - minZ) * newSize[0] * newSize[1];
          croppedData[dstIdx] = data[srcIdx];
        }
      }
    }

    // Update image metadata
    const newOrigin = [
      itkImage.origin[0] + minX * itkImage.spacing[0],
      itkImage.origin[1] + minY * itkImage.spacing[1],
      itkImage.origin[2] + minZ * itkImage.spacing[2],
    ];

    return {
      ...itkImage,
      size: newSize,
      origin: newOrigin,
      data: croppedData,
    };

    function connectedComponentLabeling(binaryMask, size) {
      const labels = new Int16Array(binaryMask.length); // Array to store labels
      const labelMap = new Map(); // Map to store label equivalences
      let currentLabel = 1; // Initial label

      // Define neighbors offsets for 3D case
      const neighborOffsets = [
        -1, 0, 0, 0, -1, 0, 0, 0, -1, 1, 0, 0, 0, 1, 0, 0, 0, 1,
      ];

      // Function to get the label of a neighboring voxel
      const getNeighborLabel = (x, y, z, neighborIndex) => {
        const nx = x + neighborOffsets[neighborIndex * 3];
        const ny = y + neighborOffsets[neighborIndex * 3 + 1];
        const nz = z + neighborOffsets[neighborIndex * 3 + 2];
        if (
          nx >= 0 &&
          nx < size[0] &&
          ny >= 0 &&
          ny < size[1] &&
          nz >= 0 &&
          nz < size[2]
        ) {
          return labels[nx + ny * size[0] + nz * size[0] * size[1]];
        }
        return 0;
      };

      // Function to find the root label of an equivalence class
      const findRootLabel = (label) => {
        while (labelMap.has(label)) {
          label = labelMap.get(label);
        }
        return label;
      };

      // First pass: labeling
      for (let z = 0; z < size[2]; z++) {
        for (let y = 0; y < size[1]; y++) {
          for (let x = 0; x < size[0]; x++) {
            const idx = x + y * size[0] + z * size[0] * size[1];
            if (binaryMask[idx] === 1) {
              // Get neighboring labels
              const neighborLabels = [];
              for (let neighborIndex = 0; neighborIndex < 6; neighborIndex++) {
                const neighborLabel = getNeighborLabel(x, y, z, neighborIndex);
                if (neighborLabel !== 0) {
                  neighborLabels.push(neighborLabel);
                }
              }
              if (neighborLabels.length === 0) {
                labels[idx] = currentLabel;
                currentLabel++;
              } else {
                // Find the minimum neighbor label
                const minNeighborLabel = Math.min(...neighborLabels);
                labels[idx] = minNeighborLabel;
                // Update label equivalences
                for (const neighborLabel of neighborLabels) {
                  if (neighborLabel !== minNeighborLabel) {
                    labelMap.set(neighborLabel, minNeighborLabel);
                  }
                }
              }
            }
          }
        }
      }

      // Second pass: relabeling
      for (let i = 0; i < labels.length; i++) {
        if (labels[i] !== 0) {
          labels[i] = findRootLabel(labels[i]);
        }
      }

      // Count the number of unique labels
      const uniqueLabels = new Set(labels);
      uniqueLabels.delete(0); // Remove background label
      const numLabels = uniqueLabels.size;

      return { labels, numLabels };
    }
  }
  */
}
///////////////////////////
