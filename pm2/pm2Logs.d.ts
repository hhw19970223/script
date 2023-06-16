declare module HHW {
    /**
     * 企业微信推送 通过markdown格式
     * @param {string} msg
     * @param {string} key
     * @param {string} name
     */
    function pushWx_markdown(msg: string, key: string, name?: string): void;
}
