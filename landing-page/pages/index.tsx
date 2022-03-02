import { NextSeo } from "next-seo";
import { HomePage } from "../src/components/HomePage";

export default () => {
    return (
        <>
            <NextSeo
                title="Home"
                titleTemplate="righthisway | %s"
                description="Description here"
            />
            <HomePage />
        </>
    );
};
