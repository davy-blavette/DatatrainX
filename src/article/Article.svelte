<script>
	import HyperparameterView from '../detail-view/Hyperparameterview.svelte';
  import Youtube from './Youtube.svelte';

	let softmaxEquation = `$$\\text{Softmax}(x_{i}) = \\frac{\\exp(x_i)}{\\sum_j \\exp(x_j)}$$`;
	let reluEquation = `$$\\text{ReLU}(x) = \\max(0,x)$$`;

  let currentPlayer;
</script>

<body>
  <div id="description">
    <h2>DataTrainX c'est quoi ?</h2>
    <p>
        Dans l’apprentissage, une logique de la restitution qui prévaut encore sur une logique de la compréhension serait à l’origine de nombreux échecs de l’apprenant. Pour se comprendre, comprendre le monde et autrui, tout apprenant produit et met en œuvre des ressources métacognitives.
    </p>
  	<p>
        On observera que cela fait appel à de nombreuses disciplines, comme la psychologie, la pédagogie, les neurosciences mais aussi le management, qui demandera à l’équipe enseignante une formation continue pour s’appuyer sur de tels dispositifs, légers et adaptables.
  	</p>

  </div>
</body>