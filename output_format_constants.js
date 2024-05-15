const DETOutputFormat = [
    'bbox_cx',
    'bbox_cy',
    'bbox_width',
    'bbox_height',
    'score',
    'object_category',
    'object_subcategory',
    'truncation',
    'occlusion'
];

const MOTOutputFormat = [
    'frame_index',
    'target_id',
    'bbox_cx',
    'bbox_cy',
    'bbox_width',
    'bbox_height',
    'score',
    'object_category',
    'object_subcategory',
    'truncation',
    'occlusion'
];

const metadataOutputFormat = [
    'precisionTimeStamp',
    'platformTailNumber',
    'platformHeadingAngle',
    'platformPitchAngle',
    'platformRollAngle',
    'platformDesignation',
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
    'offsetCornerLongitudePoint4',
    'plaftformSpeed',
    'sensorExposureTime',
	  'platformcamRotationMatrix'
]

module.exports = {
    DETOutputFormat,
    MOTOutputFormat,
    metadataOutputFormat,
};