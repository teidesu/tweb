export default function defineNotNumerableProperties<T extends any>(obj: T, names: (keyof T)[]) {
  // const perf = performance.now();
  const props = { writable: true, configurable: true };
  const out: {[name in keyof T]?: typeof props} = {};
  names.forEach((name) => {
    if (!(obj as object).hasOwnProperty(name)) {
      out[name] = props;
    }
  });
  Object.defineProperties(obj, (out as PropertyDescriptorMap & ThisType<any>));
  // console.log('defineNotNumerableProperties time:', performance.now() - perf);
}
