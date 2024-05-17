const PATH_STRING = {
    test: 'Test',
    train: 'Train',
    val: 'Val',
    det_mot: 'DETMOT',
    mcmot: 'MCMOT',
    det: 'Annotation Det',
    det_visualized: 'Annotation Det Visualized',
    mot: 'Annotation MOT',
    mot_visualized: 'AnnotationMOTVisualized',
    images: 'Images',
    meta: 'Meta',
    mcmot_target_box: 'Annotation MCMOT TargetBox',
    mcmot_target_main: 'Annotation MCMOT TargetMain',
    mcmot_target_pos: 'Annotation MCMOT TargetPos',
    mcmot_visualized: 'Annotation MCMOT Visualized'
}

const categories = {
  'car': '0',
  'bus': '1',
  'truck': '2',
}

const colors = {
  'car0': '#FF0000',
  'car1': '#EDEA0F',
  'truck0': '#00FF00',
  'truck1': '#0000FF',
  'bus': '#0000FF',
}

const DRONE_DEFAULT_VALUES = {
  '2' : {
    'INS_PITCH_ALIGNMENT_VISABLE': '-0.500000',
    'PX2CB_X_VISABLE': '0.300000',
    'PX2CB_Y_VISABLE': '1.700000',
    'PX2CB_Z_VISABLE': '182.40000',
  },
  '3' : {
    'INS_PITCH_ALIGNMENT_VISABLE': '0',
    'PX2CB_X_VISABLE': '-1.000000',
    'PX2CB_Y_VISABLE': '-0',
    'PX2CB_Z_VISABLE': '178',
  },
  '4' : {
    'INS_PITCH_ALIGNMENT_VISABLE': '2',
    'PX2CB_X_VISABLE': '-2.6',
    'PX2CB_Y_VISABLE': '0.5',
    'PX2CB_Z_VISABLE': '180',
  },
  '5' : {
    'INS_PITCH_ALIGNMENT_VISABLE': '0',
    'PX2CB_X_VISABLE': '-1.5',
    'PX2CB_Y_VISABLE': '3',
    'PX2CB_Z_VISABLE': '180',
  },
}

module.exports = { PATH_STRING, categories, colors, DRONE_DEFAULT_VALUES }