import gsap from 'gsap';
import ScrollSmoother from 'gsap/dist/ScrollSmoother';
import ScrollTrigger from 'gsap/dist/ScrollTrigger';

type Subscriber = (progress?: number) => {};
const subscribers: Subscriber[] = [];
export const scrollSmooth = {
	subscribe: (fn: Subscriber) => {
		subscribers.push(fn);
	},
	top: 0,
	progress: 0
};

export function initScrollSmooth() {
	gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

	return ScrollSmoother.create({
		smooth: 2,
		effects: true,
		onUpdate: (smooth) => {
			scrollSmooth.progress = smooth.progress;
			scrollSmooth.top = smooth.progress * (document.body.scrollHeight - window.innerHeight);
			subscribers.forEach((fn) => fn(scrollSmooth.top));
		}
	});
}
