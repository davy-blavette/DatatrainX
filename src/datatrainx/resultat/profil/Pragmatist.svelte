<script>
    import Score from "./score/Score.svelte";
    export let score;

</script>
<style>
    .fa-xs {
        height: 10px;
    }
</style>
<div class="category">
    <h2 class="title is-4">
        Pragmatist, veulent des raccourcis et des conseils. Ils apprennent mieux des activités où :
    </h2>
    <hr>
    <div class="columns">
        <div class="column is-three-quarters">
            <ul>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il existe un lien clair avec un problème lié à l'emploi
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Le matériel est orienté vers des techniques qui facilitent leur travail
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Ils sont capables de mettre en pratique ce qu'ils ont appris
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Ils peuvent se rapporter à un modèle de réussite
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Il existe de nombreuses possibilités de mettre en œuvre ce qui a été appris
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    La pertinence est évidente et l'apprentissage est facilement transférable à leur travail
                </li>
                <li>
                    <svg class="svg-inline--fa fa-caret-right fa-w-6 fa-xs icon-padding-right" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="caret-right" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" data-fa-i2svg=""><path fill="currentColor" d="M0 384.662V127.338c0-17.818 21.543-26.741 34.142-14.142l128.662 128.662c7.81 7.81 7.81 20.474 0 28.284L34.142 398.804C21.543 411.404 0 402.48 0 384.662z"></path></svg><!-- <i class="fas fa-caret-right fa-xs icon-padding-right"></i> Font Awesome fontawesome.com -->
                    Ce qui est fait est pratique comme l'élaboration de plans d'action ou l'expérimentation de techniques ou de procédures
                </li>
            </ul>
        </div>
        <Score score="{score}"/>
    </div>
    <hr>
</div>