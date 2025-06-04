import { loadPolars } from "../../../core/data/loaders/polars-loader";

describe("polarsLoader integration", () => {
  test("should load the real polars module successfully", () => {
    const polars = loadPolars();

    expect(polars).toBeDefined();
    expect(typeof polars.DataFrame).toBe("function");
    expect(typeof polars.readCSV).toBe("function");
  });

  test("should be able to create a DataFrame", () => {
    const polars = loadPolars();
    const df = polars.DataFrame({ test: [1, 2, 3] });

    expect(df).toBeDefined();
    expect(df.height).toBe(3);
  });

  test("should use strategy pattern successfully", () => {
    const polars = loadPolars();

    expect(polars).toBeDefined();
    expect(typeof polars.DataFrame).toBe("function");
  });
});
