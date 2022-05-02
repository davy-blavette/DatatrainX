<script>


    import * as faceapi from 'datatrainX';


    // ssd_mobilenetv1 options
    //let minConfidence = 0.5
    //const options = new faceapi.SsdMobilenetv1Options({ minConfidence })

    // tiny_face_detector options
    let inputSize = 512
    let scoreThreshold = 0.5
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })

    let clientHeight;
    let clientWidth;
    let myCanvas;
    let msgButton = "Juste pour voir!";
    let videoSource = null;
    let stream = null;
    let loading = false;
    let playVideo = false;


    const videoCam = async () => {

        loading = true;
        //await faceapi.nets.ssdMobilenetv1.load('./weights/');
        await faceapi.nets.tinyFaceDetector.load('./weights/');
        await faceapi.loadFaceExpressionModel('./weights/')

        if(!playVideo){
            stream = await navigator.mediaDevices.getUserMedia({video: true,audio:false});
            videoSource.srcObject = stream;
            videoSource.play();
            playVideo = true;
            videoSource.hidden = false;
            myCanvas.hidden = false;
            msgButton = "Ok j'ai vu!";
        }else{
            stream.getTracks().forEach(function(track) {
                track.stop();
                msgButton = "Juste pour voir!";
            });
            videoSource.hidden = true;
            myCanvas.hidden = true;
            playVideo = false;
            loading = false;
        }

    };


    async function onPlay() {

        const result = await faceapi.detectSingleFace(videoSource, options).withFaceExpressions();

        if (result) {


            const dims = faceapi.matchDimensions(myCanvas, {width: clientWidth, height: clientHeight});

            const resizedResult = faceapi.resizeResults(result, dims);
            const minConfidence = 0.05;

            faceapi.draw.drawDetections(myCanvas, resizedResult);
            faceapi.draw.drawFaceExpressions(myCanvas, resizedResult, minConfidence);
            loading = false;
        }

        if(playVideo){
            setTimeout(() => onPlay());
        }

    }


</script>

<style>

    #overlay {
        position: absolute;
        top: 0;
        left: 0;
    }
    .videoContent{
        position: relative;
        background-position: center;
        background-image: url("./assets/img/video.png");
        background-size: 50%;
        background-repeat: no-repeat;
        min-width: 200px;

    }

    #inputVideo{
        width: 100%;
    }

</style>

<div>
    <button class="button are-medium center is-danger" on:click={videoCam}>
            <span class="icon">
                <i class="fa-solid fa-video"></i>
            </span>
        <span>{msgButton}</span>
    </button>
    {#if loading}
    <button class="button is-warning is-loading center">Loading</button>
    {/if}
    <div class="videoContent" bind:clientWidth bind:clientHeight>
        <video id="inputVideo" on:loadedmetadata="{onPlay}"  bind:this={videoSource}>
            <track kind="caption">
        </video>
        <canvas id="overlay" bind:this={myCanvas} />
    </div>

</div>

