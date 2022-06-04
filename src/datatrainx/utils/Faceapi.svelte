<script>
    import {fly } from 'svelte/transition';
    import * as faceapi from 'datatrainX';
    import {
        layoutStore,
        videoStore,
        timeStore,
        fpsStore,
        loadingStore,
        infoLoadStore, layoutTrainxStore
    } from "../../stores";
    import {FaceExpression, FaceDetection, streamExpression} from "../../service-factory/data";
    import {updatePush} from "../../service-factory/update";
    import {fade} from 'svelte/transition';
    import Loading from "./Loading.svelte";


    // ssd_mobilenetv1 options
    const minConfidence = 0.05;
    //const options = new faceapi.SsdMobilenetv1Options({ minConfidence })

    // tiny_face_detector options
    let inputSize = 512;
    let scoreThreshold = 0.5;
    //const options = new faceapi.TinyFaceDetectorOptions({inputSize, scoreThreshold})
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence });

    let myCanvas;
    let snapCanvas;
    let finalCanvas;
    let msgButton = "Juste pour voir!";
    let videoSource = null;
    let stream = null;
    let loading = false;
    let layoutValue;
    let playVideo;
    let forwardTimes = [];
    let width;
    let height;
    let bgimage = "./assets/img/video.png";
    let time = 0;
    let fps = 0;
    let layoutTrainx;
    let modalFaq = false;

    videoStore.subscribe(value => {
        playVideo = value;
    });
    loadingStore.subscribe(value => {
        loading = value;
    });
    layoutTrainxStore.subscribe(value => {
        layoutTrainx = value;
    });
    layoutStore.subscribe(value => {
        layoutValue = value;
    });

    timeStore.subscribe(value => {
        time = value;
    });

    fpsStore.subscribe(value => {
        fps = value;
    });

    const playCam = async () => {
        loadingStore.set(true);
        //await faceapi.nets.tinyFaceDetector.load('./weights/');
        infoLoadStore.set("Chargement reconnaissance du visage...");
        await faceapi.nets.ssdMobilenetv1.load('./weights/');
        infoLoadStore.set("Chargement reconnaissance des expressions...");
        await faceapi.loadFaceExpressionModel('./weights/');
        infoLoadStore.set("Détection du visage...");
        stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
        videoSource.srcObject = stream;
        videoSource.play();
        videoSource.hidden = false;
        myCanvas.hidden = false;
        msgButton = "Arrêter webcam";
        videoStore.set(true);
    };

    function updateTimeStats(timeInMs) {
        forwardTimes = [timeInMs].concat(forwardTimes).slice(0, 30)
        const avgTimeInMs = forwardTimes.reduce((total, t) => total + t) / forwardTimes.length;
        timeStore.set(`${Math.round(avgTimeInMs)} ms`);
        fpsStore.set(`${faceapi.utils.round(1000 / avgTimeInMs)} fps`);
    }

    async function onPlay() {
        const now = Date.now();
        const result = await faceapi.detectSingleFace(videoSource, options).withFaceExpressions();
        updateTimeStats(Date.now() - now);

        if (result) {
            loading = false;
            streamExpression.peur.push({
                x: now,
                y: Object.values(result)[1]["Peur"],
            });
            streamExpression.joie.push({
                x: now,
                y: Object.values(result)[1]["Joie"],
            });
            streamExpression.degout.push({
                x: now,
                y: Object.values(result)[1]["Dégoût"],
            });
            streamExpression.surprise.push({
                x: now,
                y: Object.values(result)[1]["Surprise"],
            });
            streamExpression.triste.push({
                x: now,
                y: Object.values(result)[1]["Triste"],
            });
            streamExpression.colere.push({
                x: now,
                y: Object.values(result)[1]["Colère"],
            });
            if (playVideo) {
                const dims = faceapi.matchDimensions(myCanvas, {
                    width: videoSource.videoWidth,
                    height: videoSource.videoHeight
                });
                const resizedResult = faceapi.resizeResults(result, dims);
                //console.log(resizedResult.detection._box);
                takePicture(resizedResult);
                //faceapi.draw.drawDetections(myCanvas, resizedResult);
                //faceapi.draw.drawFaceExpressions(myCanvas, resizedResult, minConfidence);
            }
        }else{
            loadingStore.set(true);
        }
        if (playVideo) {
            setTimeout(() => onPlay());
        } else {
            stopCam();
        }

    }

    const stateVideo = async () => {
        if (playVideo) {
            stopCam();
        } else {
            playCam();
        }
    };

    function stopCam() {
        stream.getTracks().forEach(function (track) {
            track.stop();
            msgButton = "Juste pour voir!";
            videoStore.set(false);
            loadingStore.set(false);
        });
    }

    function takePicture(resizedResult) {
        loadingStore.set(false);
        let box = resizedResult.detection._box;
        snapCanvas.width = videoSource.videoWidth;
        snapCanvas.height = videoSource.videoHeight;
        let ctx = snapCanvas.getContext("2d");
        ctx.drawImage(
            videoSource,
            box._x,
            box._y,
            box._width,
            box._height,
            0, 0, box._width, box._height
        );
        let final = finalCanvas.getContext('2d');
        finalCanvas.width = box._width;
        finalCanvas.height = box._height;
        final.drawImage(
            snapCanvas,
            0,
            0,
            box._width,
            box._height,
            0, 0, box._width, box._height
        );

        let valide = false;
        for (const [key, value] of Object.entries(resizedResult.expressions)) {
            if(key != 'Neutre' && value > 0.2){
                valide = true;
                break;
            }
        }

        if(valide){
            pushData(Object.values(resizedResult)[1], Object.values(resizedResult)[0], finalCanvas.toDataURL('image/jpeg'));
        }
        faceapi.draw.drawFaceExpressions(finalCanvas, resizedResult, minConfidence);

    }

    function pushData(DataExpression, DataDetection, DataImage){

        FaceDetection.score = faceapi.utils.round(DataDetection.score);
        FaceDetection.box.height = faceapi.utils.round(DataDetection.box.height);
        FaceDetection.box.width = faceapi.utils.round(DataDetection.box.width);
        FaceDetection.box.x = faceapi.utils.round(DataDetection.box.x);
        FaceDetection.box.y = faceapi.utils.round(DataDetection.box.y);
        FaceDetection.imageDims.height = DataDetection.imageDims.height;
        FaceDetection.imageDims.width = DataDetection.imageDims.width;
        FaceDetection.image = DataImage;
        FaceExpression.colere = faceapi.utils.round(DataExpression.Colère);
        FaceExpression.degout = faceapi.utils.round(DataExpression.Dégoût);
        FaceExpression.joie = faceapi.utils.round(DataExpression.Joie);
        FaceExpression.neutre = faceapi.utils.round(DataExpression.Neutre);
        FaceExpression.peur = faceapi.utils.round(DataExpression.Peur);
        FaceExpression.surprise = faceapi.utils.round(DataExpression.Surprise);
        FaceExpression.triste = faceapi.utils.round(DataExpression.Triste);

        let data = {
            FaceDetection,
            FaceExpression,
            created: Date.now()
        }
        if (layoutTrainx == "kolb") {
            updatePush('dataExpression', data);
        }
        //console.log(dataExpression);
    }

    if (layoutValue !== "presentation") {
        playCam();
    };
</script>

<style>

    #overlay {
        position: absolute;
        top: 0;
        left: 0;
    }
    .hero-body{
        padding: 0;
        background: var(--blue);
    }
    .faceCam{
        position: relative;
    }
    .bgCam{
        height: 200px;
        width: 100%;
        background-position: center;
        background-image: url("./assets/img/video.png");
        background-size: contain;
        background-repeat: no-repeat;
    }
    .hero-body{
        overflow: hidden;
        height: 250px;
    }
    #inputVideo{
        width: 100%;

    }
    #final{
        margin: auto;
    }

    .capture{
        visibility:hidden;
        position: absolute;
        display: none;
    }
    .fps{
        font-size: .75rem;
        display: block;
        padding: 0 1em;
        line-height: 30px;
    }
    .cam-buttons{
        display: flex;
        background: var(--blue);
    }
    .cam-buttons .playvideo i{
        color: #ff0000;
        animation: blink-animation 1s steps(2, start) infinite;
    }
    .cam-faq {
        position: absolute;
        bottom: 25px;
        z-index: 99;
        font-size: .75rem;
        padding: 0 1em;
        line-height: 30px;
    }
    .cam-faq a{
        text-decoration: none;
    }
    .modal .notification{
        color: black;
    }
    @keyframes blink-animation{
        to {
            visibility: hidden;
        }
    }
</style>



<div class="hero is-halfheight">
    <div class="cam-buttons">
        {#if loading}
            <button class="button is-small is-warning is-loading">Loading</button>
        {:else}
            <button class="button is-small is-link" class:playvideo={playVideo} on:click={stateVideo}>
                <span class="icon">
                    <i class="fa-solid fa-video"></i>
                </span>
                <span>{msgButton}</span>
            </button>
        {/if}
        <div class="fps tile is-parent has-text-right">
            {time} - {fps}
        </div>
    </div>
    <div class="cam-faq">
        <a href="{'#'}" on:click ={() => modalFaq = true}>problemes FAQ ?</a>
    </div>
    {#key modalFaq}
        <div class="modal {modalFaq ? 'is-active' : ''}" in:fly="{{ y: 200, duration: 1000 }}">
            <div class="modal-background" on:click ={() => modalFaq = false}></div>
            <div class="modal-content">
                <div class="notification">
                    <strong>Le loading est toujours en cours (entre 1 et 2 minutes) :</strong>
                    <p>Le chargment du modele de reconnaissance du visage fait 5mo, le chargement peut être long. Patientez encore un peu.</p>
                    <strong>Le loading est vraiment trés trés long (plus de 2 minutes) :</strong>
                    <p>Il est possible que votre webcam ne se lance pas, vérifier les paramètres navigateurs, pour débloquer l'accés.</p>
                    <strong>La vidéo clignote, il y'a des difficultés à reconnaitre mon visage :</strong>
                    <p>Si vous êtes devant une fenêtre, il est possible qu'il y'ait trop de luminosité, essayer de changer de place ou fermer les rideaux.</p>
                    <strong>Il ne reconnait pas mes émotions :</strong>
                    <p>Ne soyez pas masqué, évitez de trop bouger ou encore ne soyez pas trop loin de votre caméra.</p>
                </div>
            </div>
        </div>
    {/key}
    <div class="hero-body faceCam">
        {#if playVideo || loading}
            {#if loading}
                <Loading />
            {/if}
            <canvas id="final" bind:this={finalCanvas} />
            {:else}
            <div class="bgCam" transition:fade></div>
        {/if}

    </div>
    <div class="capture">
        <div class="videoContent">
            <video id="inputVideo" on:loadedmetadata="{onPlay}"  bind:this={videoSource}>
            </video>
            <canvas id="overlay" bind:this={myCanvas} />
            <canvas id="snap" bind:this={snapCanvas} />
        </div>
    </div>
</div>


