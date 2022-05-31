
import { ONetParams } from './types';
export declare function ONet(x: tf.Tensor4D, params: ONetParams): {
    scores: tf.Tensor1D;
    regions: tf.Tensor2D;
    points: tf.Tensor2D;
};
