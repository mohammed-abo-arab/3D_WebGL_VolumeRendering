// Scalar opacity
$(volume_id_scalar_opacity).change(function () {
  const scalarOpacityValue = parseFloat(this.value);
  console.log("New scalar opacity value:", scalarOpacityValue);

  // Create a new scalar opacity transfer function
  const scalarOpacityTransferFunction =
    vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();
  scalarOpacityTransferFunction.addPoint(-1000, 0.0); // Air: fully transparent
  scalarOpacityTransferFunction.addPoint(-600, 0.05); // Lung: slightly more opaque
  scalarOpacityTransferFunction.addPoint(-400, 0.1); // Fat: slightly opaque
  scalarOpacityTransferFunction.addPoint(0, 0.2); // Soft Tissue: slightly opaque
  scalarOpacityTransferFunction.addPoint(50, 0.3); // Skin: more opaque
  scalarOpacityTransferFunction.addPoint(150, 0.4); // Muscle: more opaque
  scalarOpacityTransferFunction.addPoint(300, 0.9); // Peripheral Arteries with Contrast: highlight
  scalarOpacityTransferFunction.addPoint(500, 0.5); // Fat: more opaque
  scalarOpacityTransferFunction.addPoint(700, 0.85); // Bone: less transparent
  scalarOpacityTransferFunction.addPoint(2000, 1.0); // Dense Bone: opaque

  // Log the scalar opacity transfer function points
  console.log("Scalar opacity transfer function created.");

  // Update the volume property
  volume_opacity_val.setScalarOpacity(0, scalarOpacityTransferFunction);
  volume_opacity_val.setRGBTransferFunction(0, lookupTable);

  // Ensure the volume property is updated
  volume_opacity_val.modified();

  // Log to confirm volume property update
  console.log(
    "Volume property updated with new scalar opacity transfer function."
  );

  // Refresh the render window
  renderWindow.render();
  console.log("Render window refreshed with updated scalar opacity.");
});

////////////////////////////////////////////////////////////////

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
