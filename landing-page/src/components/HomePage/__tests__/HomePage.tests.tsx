import * as React from "react";
import TestRenderer from "react-test-renderer";
import { HomePage } from "../component";

describe("HomePage", () => {
    test("renders", () => {
        const tree = TestRenderer.create(<HomePage />).toJSON();
        expect(tree).toMatchSnapshot();
    });
});
