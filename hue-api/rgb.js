"use strict";

var XY = function (x, y) {
        this.x = x;
        this.y = y;
    }
    , hueLimits = {
        red: new XY(0.675, 0.322),
        green: new XY(0.4091, 0.518),
        blue: new XY(0.167, 0.04)
    }
    , livingColorsLimits = {
        red: new XY(0.704, 0.296),
        green: new XY(0.2151, 0.7106),
        blue: new XY(0.138, 0.08)
    }
    , defaultLimits = {
        red: new XY(1.0, 0),
        green: new XY(0.0, 1.0),
        blue: new XY(0.0, 0.0)
    }
    ;

function _crossProduct(p1, p2) {
    return (p1.x * p2.y - p1.y * p2.x);
}

function _isInColorGamut(p, lampLimits) {
    var v1 = new XY(
            lampLimits.green.x - lampLimits.red.x
            , lampLimits.green.y - lampLimits.red.y
        )
        , v2 = new XY(
            lampLimits.blue.x - lampLimits.red.x
            , lampLimits.blue.y - lampLimits.red.y
        )
        , q = new XY(p.x - lampLimits.red.x, p.y - lampLimits.red.y)
        , s = _crossProduct(q, v2) / _crossProduct(v1, v2)
        , t = _crossProduct(v1, q) / _crossProduct(v1, v2)
        ;

    return (s >= 0.0) && (t >= 0.0) && (s + t <= 1.0);
}

/**
 * Find the closest point on a line. This point will be reproducible by the limits.
 *
 * @param start {XY} The point where the line starts.
 * @param stop {XY} The point where the line ends.
 * @param point {XY} The point which is close to the line.
 * @return {XY} A point that is on the line specified, and closest to the XY provided.
 */
function _getClosestPoint(start, stop, point) {
    var AP = new XY(point.x - start.x, point.y - start.y)
        , AB = new XY(stop.x - start.x, stop.y - start.y)
        , ab2 = AB.x * AB.x + AB.y * AB.y
        , ap_ab = AP.x * AB.x + AP.y * AB.y
        , t = ap_ab / ab2
        ;

    if (t < 0.0) {
        t = 0.0;
    } else if (t > 1.0) {
        t = 1.0;
    }

    return new XY(
        start.x + AB.x * t
        , start.y + AB.y * t
    );
}

function _getDistanceBetweenPoints(pOne, pTwo) {
    var dx = pOne.x - pTwo.x
        , dy = pOne.y - pTwo.y
        ;
    return Math.sqrt(dx * dx + dy * dy);
}

function _getXYStateFromRGB(red, green, blue, limits) {
    var r = _gammaCorrection(red)
        , g = _gammaCorrection(green)
        , b = _gammaCorrection(blue)
        , X = r * 0.4360747 + g * 0.3850649 + b * 0.0930804
        , Y = r * 0.2225045 + g * 0.7168786 + b * 0.0406169
        , Z = r * 0.0139322 + g * 0.0971045 + b * 0.7141733
        , cx = X / (X + Y + Z)
        , cy = Y / (X + Y + Z)
        , xyPoint
        ;

    cx = isNaN(cx) ? 0.0 : cx;
    cy = isNaN(cy) ? 0.0 : cy;

    xyPoint = new XY(cx, cy);

    if (!_isInColorGamut(xyPoint, limits)) {
        xyPoint = _resolveXYPointForLamp(xyPoint, limits);
    }

    return [xyPoint.x, xyPoint.y];
}

/**
 * When a color is outside the limits, find the closest point on each line in the CIE 1931 'triangle'.
 * @param point {XY} The point that is outside the limits
 * @param limits The limits of the bulb (red, green and blue XY points).
 * @returns {XY}
 */
function _resolveXYPointForLamp(point, limits) {

    var pAB = _getClosestPoint(limits.red, limits.green, point)
        , pAC = _getClosestPoint(limits.blue, limits.red, point)
        , pBC = _getClosestPoint(limits.green, limits.blue, point)
        , dAB = _getDistanceBetweenPoints(point, pAB)
        , dAC = _getDistanceBetweenPoints(point, pAC)
        , dBC = _getDistanceBetweenPoints(point, pBC)
        , lowest = dAB
        , closestPoint = pAB
        ;

    if (dAC < lowest) {
        lowest = dAC;
        closestPoint = pAC;
    }

    if (dBC < lowest) {
        closestPoint = pBC;
    }

    return closestPoint;
}

function _gammaCorrection(value) {
    var result = value;
    if (value > 0.04045) {
        result = Math.pow((value + 0.055) / (1.0 + 0.055), 2.4);
    } else {
        result = value / 12.92;
    }
    return result;
}

function _getLimits(lightDetails) {
    var limits = defaultLimits
        , modelId
        ;

    if (lightDetails.modelid) {
        modelId = lightDetails.modelid.toLowerCase();

        if (/^lct/.test(modelId)) {
            // This is a Hue bulb
            limits = hueLimits;
        } else if (/^llc/.test(modelId)) {
            // This is a Living Color lamp (Bloom, Iris, etc..)
            limits = livingColorsLimits;
        } else if (/^lwb/.test(modelId)) {
            // This is a lux bulb
            limits = defaultLimits;
        } else {
            limits = defaultLimits;
        }
    }

    return limits;
}

module.exports = {
    convertRGBtoXY: function(rgb, lightDetails) {
        var limits = _getLimits(lightDetails);

        return _getXYStateFromRGB(rgb[0], rgb[1], rgb[2], limits);
    }
};