<script>
    import {infoLoadStore} from "../../stores";

    let infoLoad = "";
    infoLoadStore.subscribe(value => {
        infoLoad = value;
    });
</script>
<style>

    body {
        background: #222;
        text-align: center;
        padding: 20%;
    }
    h2 {
        color: #ccc;
        margin: 0;
        font: .8em verdana;
        text-transform: uppercase;
        letter-spacing: .1em;
    }

    .loading{
        position: absolute;
        text-align: center;
        background: var(--blue);
        height: 100%;
        width: 100%;
    }
    .middle{
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        position: absolute;
    }
    .loading span {
        display: inline-block;
        vertical-align: middle;
        width: .6em;
        height: .6em;
        margin: .19em;
        background: #FF6B6B;
        border-radius: .6em;
        animation: loading 1s infinite alternate;
    }

    .loading span:nth-of-type(2) {
        background: #FFD93D;
        animation-delay: 0.2s;
    }
    .loading span:nth-of-type(3) {
        background: #6BCB77;
        animation-delay: 0.4s;
    }
    .loading span:nth-of-type(4) {
        background: #4D96FF;
        animation-delay: 0.6s;
    }
    .loading span:nth-of-type(5) {
        background: #AB46D2;
        animation-delay: 0.8s;
    }
    .loading span:nth-of-type(6) {
        background: #FF6FB5;
        animation-delay: 1.0s;
    }
    .loading span:nth-of-type(7) {
        background: aliceblue;
        animation-delay: 1.2s;
    }

    @keyframes loading {
        0% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
    }

</style>


<div class="loading">
    <div class="middle">
        <h2>{infoLoad}</h2>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
    </div>

</div>