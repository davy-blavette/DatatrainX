<script>


    import * as faceapi from 'datatrainX';



    const SSD_MOBILENETV1 = 'ssd_mobilenetv1'
    const TINY_FACE_DETECTOR = 'tiny_face_detector'

    let selectedFaceDetector = SSD_MOBILENETV1
    // ssd_mobilenetv1 options
    let minConfidence = 0.5
    // tiny_face_detector options
    let inputSize = 512
    let scoreThreshold = 0.5


    let videoSource = null;
    let loading = false;
    let mycanvas;
    let count = 0;



    const obtenerVideoCamara = async () => {

        loading = true;

        await changeFaceDetector(selectedFaceDetector)
        await faceapi.loadFaceExpressionModel('./weights/')

        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
        });
        videoSource.srcObject = stream;
        videoSource.play();
        loading = false;

    };


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
            await getCurrentFaceDetectionNet().load('./weights/')
        }


    }


    async function onPlay() {

        const options = getFaceDetectorOptions()
        const result = await faceapi.detectSingleFace(videoSource, options).withFaceExpressions();

        if (result) {

            const dims = faceapi.matchDimensions(mycanvas, videoSource, true)

            const resizedResult = faceapi.resizeResults(result, dims)
            const minConfidence = 0.05

            faceapi.draw.drawDetections(mycanvas, resizedResult)
            faceapi.draw.drawFaceExpressions(mycanvas, resizedResult, minConfidence)
        }

        setTimeout(() => onPlay())
    }


</script>

<style>

    #overlay {
        position: absolute;
        top: 0;
        left: 0;
    }

</style>

<div>
    <button class="button is-danger" on:click={obtenerVideoCamara}>Juste pour voir</button>
    {#if loading}
        <button class="button is-warning is-loading">Loading</button>
    {/if}
    <!-- svelte-ignore a11y-media-has-caption -->
    <div style="position: relative" class="margin">
        <video id="inputVideo" on:loadedmetadata="{onPlay}"  bind:this={videoSource} />
        <canvas id="overlay" bind:this={mycanvas} />
    </div>

</div>

