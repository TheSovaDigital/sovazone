import {handleEstimate} from './estimate.js';
export {config} from './estimate.js';
export default function handler(req,res){return handleEstimate(req,res,'telegram');}
