<script>
    import * as animateScroll from "svelte-scrollto";
    import {layoutStore} from "../../stores";
</script>
<style>

    .footer{
        color: #ffffff;
        background-color: #333333;
        padding-bottom: 1em;
    }

    .footer .logo-text{
        font-size: 30px;
        color: var(--light-gray);
        font-family: 'Hemicube';
        margin-right: 10px;
    }

    .footer .icon {
        margin-left: 0px;
        height: auto;
        width: auto;
    }
    .footer .icon a {
        color: white;
        font-size: 2em;
    }

    .footer a:hover {
        color: white;
        text-decoration: underline;
    }

    .version{
        display: block;
    }
    .link{
        text-decoration: underline;
        cursor: pointer;
    }
    .link:hover{
        font-weight: bold;
    }

</style>
<footer class="footer">
    <div class="content has-text-centered">
        <span class="logo-text">DataTrainX</span>
        <span class="version">Version 0.8.0</span>
        <span class="link" on:click={() => animateScroll.scrollTo({element: "#header", onDone: (element, offset) => {layoutStore.setLayout("opendata")}})}>OpenData</span>
        <p>
            By <a href="https://fr.linkedin.com/in/davy-blavette-8876b952">Davy Blavette</a>. The source code is licensed
            <a href="http://opensource.org/licenses/mit-license.php">MIT</a>. The website content
            is licensed <a href="http://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY NC SA 4.0</a>.
        </p>
        <div class="icon" title="Open-source code"><a target="_blank" href="https://github.com/davy-blavette/DatatrainX"><i class="fa-brands fa-github"></i></a></div>
    </div>
</footer>