const DETInputFormat = {
    'frameNo': 0,
    'name': 1,
    'id':2,
    'minx': 3,
    'miny': 4,
    'width': 5,
    'height': 6
}

const MOTInputFormat = {
    'frameNo': 0,
    'id': 1,
    'minx': 2,
    'miny': 3,
    'width': 4,
    'height': 5
}

const KLVInputFormat = [
    'precisionTimeStamp',
    'platformHeadingAngle',
    'platformPitchAngle',
    'platformRollAngle',
    'imageSourceSensor',
    'sensorLatitude',
    'sensorLongitude',
    'sensorTrueAltitude',
    'sensorHorizontalFieldOfView',
    'sensorVerticalFieldOfView',
    'sensorRelativeAzimuthAngle',
    'sensorRelativeElevationAngle',
    'sensorRelativeRollAngle',
    'slantRange',
    'frameCenterLatitude',
    'frameCenterLongitude',
    'frameCenterElevation',
    'offsetCornerLatitudePoint1',
    'offsetCornerLongitudePoint1',
    'offsetCornerLatitudePoint2',
    'offsetCornerLongitudePoint2',
    'offsetCornerLatitudePoint3',
    'offsetCornerLongitudePoint3',
    'offsetCornerLatitudePoint4',
    'offsetCornerLongitudePoint4'
]

const PPKInputFormat = [
    'precisionTimeStamp',
    'sensorLatitude',
    'sensorLongitude',
    'sensorTrueAltitude',
]

module.exports = {
    DETInputFormat,
    MOTInputFormat,
    KLVInputFormat,
    PPKInputFormat,
};