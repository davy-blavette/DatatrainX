<script>


</script>
<style>
    .start {
        background-color: #3b065e;
        scrollbar-width: auto;
        scrollbar-color: #8f54a0 #3b065e;
    }

    /* Chrome, Edge, and Safari */
    *::-webkit-scrollbar {
        width: 16px;
    }

    *::-webkit-scrollbar-track {
        background: #3b065e
    }

    *::-webkit-scrollbar-thumb {
        background-color: #8f54a0;
        border-radius: 10px;
        border: 3px solid #3b065e;
    }
</style>

<div class="start jumbotron text-center hero-body is-vcentered is-fullheight">
    <slot></slot>
</div>
