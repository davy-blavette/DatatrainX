<script>

    import * as faceapi from 'datatrainX';
    import {layoutStore, videoStore} from "../stores";
    import {dataExpression} from "../config";



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
    let layoutValue;
    let playVideo;

    videoStore.subscribe(value => {
        playVideo = value;
    });

    layoutStore.subscribe(value => {
        layoutValue = value;
    });



    const videoCam = async () => {

        loading = true;
        //await faceapi.nets.ssdMobilenetv1.load('./weights/');
        await faceapi.nets.tinyFaceDetector.load('./weights/');
        await faceapi.loadFaceExpressionModel('./weights/')
        stream = await navigator.mediaDevices.getUserMedia({video: true,audio:false});
        videoSource.srcObject = stream;
        videoSource.play();
        videoSource.hidden = false;
        myCanvas.hidden = false;
        msgButton = "Ok j'ai vu!";
        loading = false;
        videoStore.set(true);


    };


    async function onPlay() {

        const result = await faceapi.detectSingleFace(videoSource, options).withFaceExpressions();

        //console.log(result.expressions);
        if (result) {
            const now = Date.now();
            //console.log(dataExpression.peur);
            //'Neutre', 'Joyeux', 'Triste', 'Colère', 'Peur', 'Dégoût', 'Surprise
            dataExpression.peur.push({
                x: now,
                y:Object.values(result)[1]["Peur"],
            });
            dataExpression.joie.push({
                x: now,
                y:Object.values(result)[1]["Joyeux"],
            });
            dataExpression.degout.push({
                x: now,
                y:Object.values(result)[1]["Dégoût"],
            });
            dataExpression.surprise.push({
                x: now,
                y:Object.values(result)[1]["Surprise"],
            });
            dataExpression.triste.push({
                x: now,
                y:Object.values(result)[1]["Triste"],
            });
            dataExpression.colere.push({
                x: now,
                y:Object.values(result)[1]["Colère"],
            });
//            console.log(Object.values(result)[1]);
//            console.log(Object.values(result)[1]["Neutre"]);

            const dims = faceapi.matchDimensions(myCanvas, {width: clientWidth, height: clientHeight});

            const resizedResult = faceapi.resizeResults(result, dims);
            const minConfidence = 0.05;

            faceapi.draw.drawDetections(myCanvas, resizedResult);
            faceapi.draw.drawFaceExpressions(myCanvas, resizedResult, minConfidence);

        }

        if(playVideo){
            setTimeout(() => onPlay());
        }else{
            stream.getTracks().forEach(function(track) {
                track.stop();
                msgButton = "Juste pour voir!";
            });
            videoSource.hidden = true;
            myCanvas.hidden = true;
            videoStore.set(false);
            loading = false;
        }

    }

    if(layoutValue !== "presentation"){
        videoCam();
    };

    const stateVideo = async () => {
        if(playVideo){
            videoStore.set(false);
        }else{
            videoCam();
        }

    };


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
    {#if layoutValue == "presentation"}
    <button class="button are-medium center is-danger" on:click={stateVideo}>
            <span class="icon">
                <i class="fa-solid fa-video"></i>
            </span>
        <span>{msgButton}</span>
    </button>
        {#if loading}
        <button class="button is-warning is-loading center">Loading</button>
        {/if}
    {/if}
    <div class="videoContent" bind:clientWidth bind:clientHeight>
        <video id="inputVideo" on:loadedmetadata="{onPlay}"  bind:this={videoSource}>
            <track kind="caption">
        </video>
        <canvas id="overlay" bind:this={myCanvas} />
    </div>

</div>

