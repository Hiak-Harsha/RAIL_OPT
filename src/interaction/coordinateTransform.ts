/**
 * Precision Screen-to-SVG Coordinate Transformer.
 * Converts screen pointer coordinates (clientX, clientY) into exact SVG viewBox units,
 * preserving spatial accuracy across pan, zoom, scale, and responsive layout transforms.
 */

export interface Point {
  x: number;
  y: number;
}

export function screenToSvgPoint(
  clientX: number,
  clientY: number,
  svgElement: SVGSVGElement | null,
  fallbackViewBox: { width: number; height: number } = { width: 1320, height: 380 }
): Point {
  if (!svgElement) {
    return { x: clientX, y: clientY };
  }

  try {
    const ctm = svgElement.getScreenCTM();
    if (ctm) {
      const pt = svgElement.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const transformed = pt.matrixTransform(ctm.inverse());
      return { x: transformed.x, y: transformed.y };
    }
  } catch {
    // Fallback if matrix transform is unsupported or CTM is non-invertible
  }

  const rect = svgElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return { x: 0, y: 0 };
  }

  const normX = (clientX - rect.left) / rect.width;
  const normY = (clientY - rect.top) / rect.height;

  return {
    x: normX * fallbackViewBox.width,
    y: normY * fallbackViewBox.height
  };
}
