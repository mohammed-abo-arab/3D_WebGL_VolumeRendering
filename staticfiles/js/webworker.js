// webworker.js

self.onmessage = function (e) {
  const { files, vol_color_val } = e.data;
  const vol_img = []; // Placeholder for processed images

  files.forEach((fileData, index) => {
    try {
      let itkImage = JSON.parse(fileData); // This line might be incorrect; fileData might need different handling
      let vtkImageData = convertItkToVtkImage(itkImage); // This function needs to be defined or included in the worker context
      vol_img.push(vtkImageData);
    } catch (error) {
      console.error("Error processing files:", error);
      self.postMessage({ error: "Failed to process some files." });
      return;
    }

    if (index === files.length - 1) {
      self.postMessage({ vol_img, vol_color_val });
    }
  });
};

function convertItkToVtkImage(itkImage) {
  // Implement conversion logic
  return itkImage; // Placeholder
}

const { vtkErrorMacro } = vtk.macro;

// see itk.js PixelTypes.js
const ITKJSPixelTypes = {
  Unknown: 0,
  Scalar: 1,
  RGB: 2,
  RGBA: 3,
  Offset: 4,
  Vector: 5,
  Point: 6,
  CovariantVector: 7,
  SymmetricSecondRankTensor: 8,
  DiffusionTensor3D: 9,
  Complex: 10,
  FixedArray: 11,
  Array: 12,
  Matrix: 13,
  VariableLengthVector: 14,
  VariableSizeMatrix: 15,
};

// itk-wasm pixel types from https://github.com/InsightSoftwareConsortium/itk-wasm/blob/master/src/core/PixelTypes.ts
const ITKWASMPixelTypes = {
  Unknown: "Unknown",
  Scalar: "Scalar",
  RGB: "RGB",
  RGBA: "RGBA",
  Offset: "Offset",
  Vector: "Vector",
  Point: "Point",
  CovariantVector: "CovariantVector",
  SymmetricSecondRankTensor: "SymmetricSecondRankTensor",
  DiffusionTensor3D: "DiffusionTensor3D",
  Complex: "Complex",
  FixedArray: "FixedArray",
  Array: "Array",
  Matrix: "Matrix",
  VariableLengthVector: "VariableLengthVector",
  VariableSizeMatrix: "VariableSizeMatrix",
};

const itkComponentTypeToVtkArrayType = new Map([
  ["uint8", "Uint8Array"],
  ["int8", "Int8Array"],
  ["uint16", "Uint16Array"],
  ["int16", "Int16Array"],
  ["uint32", "Uint32Array"],
  ["int32", "Int32Array"],
  ["float32", "Float32Array"],
  ["float64", "Float64Array"],
]);

/**
 * Converts an itk-wasm Image to a vtk.js vtkImageData.
 *
 * Requires an itk-wasm Image as input.
 */
function convertItkToVtkImage(itkImage, options = {}) {
  const vtkImage = {
    origin: [0, 0, 0],
    spacing: [1, 1, 1],
  };

  const dimensions = [1, 1, 1];
  const direction = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  // Check whether itkImage is an itk.js Image or an itk-wasm Image?
  const isITKWasm = itkImage.direction.data === undefined;
  const ITKPixelTypes = isITKWasm ? ITKWASMPixelTypes : ITKJSPixelTypes;

  for (let idx = 0; idx < itkImage.imageType.dimension; ++idx) {
    vtkImage.origin[idx] = itkImage.origin[idx];
    vtkImage.spacing[idx] = itkImage.spacing[idx];
    dimensions[idx] = itkImage.size[idx];
    for (let col = 0; col < itkImage.imageType.dimension; ++col) {
      if (isITKWasm) {
        direction[col + idx * 3] =
          itkImage.direction[idx + col * itkImage.imageType.dimension];
      } else {
        direction[col + idx * 3] =
          itkImage.direction.data[idx + col * itkImage.imageType.dimension];
      }
    }
  }

  // Create VTK Image Data
  const imageData = vtk.Common.DataModel.vtkImageData.newInstance(vtkImage);

  // Create VTK point data -- the data associated with the pixels / voxels
  const pointData = vtk.Common.Core.vtkDataArray.newInstance({
    name: options.scalarArrayName || "Scalars",
    values: itkImage.data,
    numberOfComponents: itkImage.imageType.components,
  });

  imageData.setDirection(direction);
  imageData.setDimensions(...dimensions);
  // Always associate multi-component pixel types with vtk.js point data
  // scalars to facilitate multi-component volume rendering
  imageData.getPointData().setScalars(pointData);

  // Associate the point data that are 3D vectors / tensors
  // Refer to itk-js/src/PixelTypes.js for numerical values
  switch (
    isITKWasm
      ? ITKPixelTypes[itkImage.imageType.pixelType]
      : itkImage.imageType.pixelType
  ) {
    case ITKPixelTypes.Scalar:
      break;
    case ITKPixelTypes.RGB:
      break;
    case ITKPixelTypes.RGBA:
      break;
    case ITKPixelTypes.Offset:
      break;
    case ITKPixelTypes.Vector:
      if (
        itkImage.imageType.dimension === 3 &&
        itkImage.imageType.components === 3
      ) {
        imageData.getPointData().setVectors(pointData);
      }
      break;
    case ITKPixelTypes.Point:
      break;
    case ITKPixelTypes.CovariantVector:
      if (
        itkImage.imageType.dimension === 3 &&
        itkImage.imageType.components === 3
      ) {
        imageData.getPointData().setVectors(pointData);
      }
      break;
    case ITKPixelTypes.SymmetricSecondRankTensor:
      if (
        itkImage.imageType.dimension === 3 &&
        itkImage.imageType.components === 6
      ) {
        imageData.getPointData().setTensors(pointData);
      }
      break;
    case ITKPixelTypes.DiffusionTensor3D:
      if (
        itkImage.imageType.dimension === 3 &&
        itkImage.imageType.components === 6
      ) {
        imageData.getPointData().setTensors(pointData);
      }
      break;
    case ITKPixelTypes.Complex:
      break;
    case ITKPixelTypes.FixedArray:
      break;
    case ITKPixelTypes.Array:
      break;
    case ITKPixelTypes.Matrix:
      break;
    case ITKPixelTypes.VariableLengthVector:
      break;
    case ITKPixelTypes.VariableSizeMatrix:
      break;
    default:
      vtkErrorMacro(
        `Cannot handle unexpected itk-wasm pixel type ${itkImage.imageType.pixelType}`
      );
      return null;
  }

  return imageData;
}
