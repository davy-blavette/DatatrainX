const SSD_MOBILENETV1 = 'ssd_mobilenetv1'
const TINY_FACE_DETECTOR = 'tiny_face_detector'

let selectedFaceDetector = SSD_MOBILENETV1
// ssd_mobilenetv1 options
let minConfidence = 0.5
// tiny_face_detector options
let inputSize = 512
let scoreThreshold = 0.5

function getFaceDetectorOptions() {
    return selectedFaceDetector === SSD_MOBILENETV1
        ? new faceapi.SsdMobilenetv1Options({ minConfidence })
        : new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })
}


function getCurrentFaceDetectionNet() {
    if (selectedFaceDetector === SSD_MOBILENETV1) {
        return faceapi.nets.ssdMobilenetv1
    }
    if (selectedFaceDetector === TINY_FACE_DETECTOR) {
        return faceapi.nets.tinyFaceDetector
    }
}

function isFaceDetectionModelLoaded() {
    return !!getCurrentFaceDetectionNet().params
}

async function changeFaceDetector(detector) {

    selectedFaceDetector = detector
    if (!isFaceDetectionModelLoaded()) {
        await getCurrentFaceDetectionNet().load('./faceapi/weights/')
    }


}





async function onPlay() {
    console.log('onPlay 1');
    const videoEl = document.querySelector('#inputVideo');
    const options = getFaceDetectorOptions()
    const result = await faceapi.detectSingleFace(videoEl, options).withFaceExpressions();
    console.log(videoEl);
    if (result) {
        const canvas = document.querySelector('#overlay');
        const dims = faceapi.matchDimensions(canvas, videoEl, true)

        const resizedResult = faceapi.resizeResults(result, dims)
        const minConfidence = 0.05

        faceapi.draw.drawDetections(canvas, resizedResult)
        faceapi.draw.drawFaceExpressions(canvas, resizedResult, minConfidence)
    }

    setTimeout(() => onPlay())
}

async function run() {
    // load face detection and face expression recognition models
    await changeFaceDetector(selectedFaceDetector)
    await faceapi.loadFaceExpressionModel('./faceapi/weights/')


    // try to access users webcam and stream the images
    // to the video element
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} })
    const videoEl = document.querySelector('#inputVideo');
    videoEl.srcObject = stream
}

run();