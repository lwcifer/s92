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
  'truck': '1',
  'bus': '2',
}

const colors = {
  'car0': '#FF0000',
  'car1': '#EDEA0F',
  'truck0': '#00FF00',
  'truck1': '#0000FF',
  'bus': '#0000FF',
}

module.exports = { PATH_STRING, categories, colors }