/* global filenameSanitize: false, store, Promise: false,
   generateASS: false, setPosition: false, parseXML: false */
(function() {
    let fetch_ = function(url) {
        return new Promise(function(resolve, reject) {
            let xhr = new XMLHttpRequest();

            xhr.onload = function() {
                resolve({
                    text: function() {
                        return xhr.responseText;
                    },
                });
            };

            xhr.onerror = xhr.ontimeout = function() {
                reject(new TypeError('Network request failed'));
            };

            xhr.open('get', url, true);
            xhr.send();
        });
    };

    if ($('html').hasClass('bilibili-helper')) {
        return false;
    }
    if (!store.enabled) {
        return false;
    }
    // 设置默认播放器
    // store.set('defaulth5', 1);
    store.delete = function(key, value) {
        if (key === undefined) {
            return;
        }
        let o = store.get(key);
        if (o === undefined) {
            return;
        }
        if (value !== undefined && value !== null) {
            if (typeof value === 'string' || typeof value === 'number') {
                o[value] && delete o[value];
                store.set(key, o);
            }
        } else {
            store.remove(key);
        }
    };
    const QUALITY_DISPLAY_NAMES = {
        112: '高清 1080P+',
        80: '高清 1080P',
        64: '高清 720P',
        48: '高清 720P',
        32: '清晰 480P',
        16: '流畅 360P',
    };
    let biliHelper = {
        playUrls: {},
        playQualities: [],
    };
    biliHelper.eval = function(fn) {
        let Fn = Function;
        return new Fn('return ' + fn)();
    };
    biliHelper.handlePlayUrl = function(data) {
        if (data.accept_quality.length > biliHelper.playQualities) {
            biliHelper.playQualities = data.accept_quality;
            biliHelper.qualityDescriptions =
                data.accept_description || biliHelper.playQualities.map(
                    (q) => QUALITY_DISPLAY_NAMES[q] || q);
        }
        biliHelper.playUrls[data.quality] = data.durl;
        const c = setInterval(() => {
            if ($('#bilibili_helper').length > 0) {
                biliHelper.renderDownloadSection();
                clearInterval(c);
            }
        }, 1000);
    };
    biliHelper.renderDownloadSection = function() {
        biliHelper.mainBlock.downloaderSection.find('p').empty();
        biliHelper.mainBlock.downloaderSection.find('p').append($('<h4>清晰度</h4>'));
        if (!biliHelper.selectedQuality || biliHelper.playQualities.indexOf(biliHelper.selectedQuality) < -1) {
            biliHelper.selectedQuality = Math.max(...Object.keys(biliHelper.playUrls));
        }
        for (let i = 0; i < biliHelper.playQualities.length; i++) {
            let qualitySwitch = $('<a class="b-btn" rel="noreferrer"></a>')
                .text(biliHelper.qualityDescriptions[i])
                .data('quality', biliHelper.playQualities[i])
                .data('description', biliHelper.qualityDescriptions[i]);
            if (biliHelper.playQualities[i] !== biliHelper.selectedQuality) {
                qualitySwitch.addClass('w');
            }
            if (!biliHelper.playUrls[biliHelper.playQualities[i]]) {
                qualitySwitch.addClass('disabled');
                qualitySwitch.text(qualitySwitch.text() + ' (未获取)');
            }
            qualitySwitch.click(function() {
                if (!$(this).hasClass('w')) {
                    return false;
                }
                if ($(this).hasClass('disabled')) {
                    window.alert('请切换播放器画质以获取' + $(this).data('description') + '下载地址.');
                    return false;
                }
                biliHelper.selectedQuality = $(this).data('quality');
                biliHelper.renderDownloadSection();
            });
            biliHelper.mainBlock.downloaderSection.find('p').append(qualitySwitch);
        }
        biliHelper.mainBlock.downloaderSection.find('p').append($('<h4>下载分段</h4>'));
        let downloadUrls = biliHelper.playUrls[biliHelper.selectedQuality];
        for (let i = 0; i < downloadUrls.length; i++) {
            let segmentInfo = downloadUrls[i];
            if (typeof segmentInfo === 'object') {
                let downloadOptions = getDownloadOptions(segmentInfo.url,
                        getNiceSectionFilename(biliHelper.avid, i, downloadUrls.length)),
                    $bhDownLink = $('<a class="b-btn w" referrerpolicy="unsafe-url"></a>')
                    .text('分段 ' + (parseInt(i) + 1))
                    // Set download attribute to better file name. When use "Save As" dialog, this value gets respected even the target is not from the same origin.
                    .data('download', downloadOptions.filename)
                    .attr('title', isNaN(parseInt(segmentInfo.filesize / 1048576 + 0.5)) ? ('长度: ' + parseTime(segmentInfo.length)) : ('长度: ' + parseTime(segmentInfo.length) + ' 大小: ' + parseInt(segmentInfo.filesize / 1048576 + 0.5) + ' MB'))
                    .attr('href', '//' + segmentInfo.url.split('://')[1]);
                biliHelper.mainBlock.downloaderSection.find('p').append($bhDownLink);
                $bhDownLink.click(function(e) {
                    chrome.runtime.sendMessage({
                        command: 'suggestName',
                        url: biliHelper.protocol + $(e.target).attr('href'),
                        filename: $(e.target).data('download'),
                    });
                });
            }
        }
        if (biliHelper.videoPic) {
            biliHelper.mainBlock.downloaderSection.find('p').append($('<a class="b-btn" target="_blank" href="' + biliHelper.videoPic + '">封面</a>'));
        }
        /* Can't download multiple videos this way.
        if (downloadUrls.length > 1) {
            let $bhDownAllLink = $('<a class="b-btn"></a>').text('下载全部共 ' + downloadUrls.length + ' 个分段');
            biliHelper.mainBlock.downloaderSection.find('p').append($bhDownAllLink);
            $bhDownAllLink.click(function(e) {
                biliHelper.mainBlock.downloaderSection.find('p .b-btn.w[referrerpolicy]').click();
            });
        }*/
    };
    if (document.location.pathname.indexOf('/blackboard/') === 0) {
        biliHelper.site = 2;
    } else if (location.hostname === 'bangumi.bilibili.com') {
        biliHelper.site = 1;
    } else if (document.location.pathname.indexOf('/bangumi/') === 0) {
        biliHelper.site = 3;
    } else if (location.hostname === 'www.bilibili.com') {
        biliHelper.site = $('#__bofqi').length ? 4 : 0;
    } else {
        return false;
    }
    biliHelper.protocol = location.protocol;

    function formatInt(Source, Length) {
        let strTemp = '';
        for (let i = 1; i <= Length - (Source + '').length; i++) {
            strTemp += '0';
        }
        return strTemp + Source;
    }

    function parseSafe(text) {
        return ('' + text).replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function parseTime(timecount) {
        return formatInt(parseInt(timecount / 60000), 2) + ':' + formatInt(parseInt((timecount / 1000) % 60), 2);
    }

    function inject_css(name, filename) {
        let styleLink = document.createElement('link');
        styleLink.setAttribute('id', name);
        styleLink.setAttribute('type', 'text/css');
        styleLink.setAttribute('rel', 'stylesheet');
        styleLink.setAttribute('href', chrome.extension.getURL(filename));
        if (document.head) {
            document.head.appendChild(styleLink);
        } else {
            document.documentElement.appendChild(styleLink);
        }
    }

    function removeAd() {
        chrome.runtime.sendMessage({
            command: 'getAd',
        }, function(response) {
            if (response.value === 'on') {
                inject_css('bilibiliHelperAdStyle', 'bilibiliHelperAd.min.css');
                biliHelper.removeAds = true;
            }
        });
    }

    removeAd();

    function closeDanmakuAtStart() {
        chrome.runtime.sendMessage({
            command: 'getDanmaku',
        }, function(response) {
            if (response.value === 'on') {
                biliHelper.closeDanmaku = true;
            }
        });
    }

    closeDanmakuAtStart();

    function initStyle() {
        inject_css('bilibiliHelperVideo', 'bilibiliHelperVideo.min.css');
    }

    function setWide(mode) {
        if (mode === 'off') {
            return;
        }
        let player = $('#bilibiliPlayer');
        const doit = () => {
            if (mode === 'wide' && !player.hasClass('mode-widescreen')) {
                let html5WidthButton = $('.bilibili-player-video-btn-widescreen');
                if (html5WidthButton.length === 0) {
                    let flashvars = $('#player_placeholder').find('param[name=flashvars]');
                    flashvars.val(flashvars.val() + '&as_wide=1');
                    $('#player_placeholder').attr('data', $('#player_placeholder').attr('data'));
                } else {
                    html5WidthButton.click();
                }
            } else if (mode === 'webfullscreen' && !player.hasClass('mode-webfullscreen')) {
                let html5WebfullscreenButton = $('.bilibili-player-video-web-fullscreen');
                if (html5WebfullscreenButton.length === 0) {
                    // todo
                } else if (html5WebfullscreenButton.length > 0) {
                    html5WebfullscreenButton.click();
                }
            }
        };
        if ($('#player_placeholder > *').length > 0) {
            doit();
        } else {
            let observer = new MutationObserver(function() {
                doit();
                observer.disconnect();
            });
            if ($('#bofqi').length > 0) {
                observer.observe($('#bofqi')[0], {
                    childList: true,
                    attributes: true,
                    subtree: true,
                    attributeFilter: ['src'],
                });
            } else if ($('#bilibiliPlayer').length > 0) {
                observer.observe($('#bilibiliPlayer')[0], {
                    childList: true,
                    attributes: true,
                    subtree: true,
                    attributeFilter: ['src'],
                });
            }
        }
    }

    function setOffset() {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
            $(document).scrollTop($('.player-wrap, .player-box').offset().top);
        }
    }

    if (biliHelper.site === 2) {
        return;
    }

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        switch (request.command) {
        case 'update':
            removeAd();
            sendResponse({
                result: 'ok',
            });
            return true;
        case 'error':
            return true;
        case 'playurl':
            if (Object.keys(request.data).length > 0) {
                biliHelper.handlePlayUrl(request.data);
            }
            return true;
        default:
            sendResponse({
                result: 'unknown',
            });
            return false;
        }
    });

    let finishUp = function() {
        if (biliHelper.playUrls.length) {
            biliHelper.renderDownloadSection();
        }
        biliHelper.domReady = true;
    };
    let initHelper = function() {
        biliHelper.playUrls = {};
        biliHelper.playQualities = [];
        biliHelper.videoPic = $('img.cover_image').attr('src');
        if (!biliHelper.page) {
            biliHelper.page = 1;
        } else {
            biliHelper.page = parseInt(biliHelper.page);
        }
        biliHelper.pageOffset = 0;
        const initPromise = new Promise(function(resolve, reject) {
            let counter = 0;
            const interValNum = setInterval(() => {
                if (biliHelper.cid) {
                    clearInterval(interValNum);
                    resolve();
                } else if (counter > 20) {
                    clearInterval(interValNum);
                    reject();
                } else {
                    ++counter;
                }
            }, 500);
        });
        initPromise.then(function() {
            chrome.runtime.sendMessage({
                command: 'init',
                cid: biliHelper.cid,
            }, function(response) {
                // biliHelper.playerConfig = response.playerConfig;
                biliHelper.version = response.version;
                biliHelper.autowide = response.autowide;
                biliHelper.autooffset = response.autooffset;
                // biliHelper.favorHTML5 = response.html5 === 'on';
                // biliHelper.replaceEnabled = response.replace === 'on';
                biliHelper.originalPlayer = localStorage.getItem('bilimac_original_player') || $('#bofqi').html();
                localStorage.removeItem('bilimac_original_player');
                biliHelper.switcher = {
                    current: 'original',
                    set: function(newMode) {
                        if (biliHelper.mainBlock.switcherSection) {
                            biliHelper.mainBlock.switcherSection.find('a.b-btn[type="' + this.current + '"]').addClass('w');
                            biliHelper.mainBlock.switcherSection.find('a.b-btn[type="' + newMode + '"]').removeClass('w');
                        }
                        this.current = newMode;
                    },
                    original: function() {
                        this.set('original');
                        $('#bofqi').html(biliHelper.originalPlayer);
                    },
                    bilimac: function() {
                        this.set('bilimac');
                        $('#bofqi').html('<div id="player_placeholder" class="player"></div><div id="loading-notice">正在加载 Bilibili Mac 客户端…</div>');
                        $('#bofqi').find('#player_placeholder').css({
                            'background': 'url(' + biliHelper.videoPic + ') 50% 50% / cover no-repeat',
                            '-webkit-filter': 'blur(20px)',
                            'overflow': 'hidden',
                            'visibility': 'visible',
                        });
                        chrome.runtime.sendMessage({
                            command: 'callBilibiliMac',
                            data: {
                                action: 'playVideoByCID',
                                data: biliHelper.cid + '|' + window.location.href + '|' + document.title + '|' + (biliHelper.cidHack === 2 ? 2 : 1),
                            },
                        }, function(succ) {
                            if (succ) {
                                $('#bofqi').find('#loading-notice').text('已在 Bilibili Mac 客户端中加载');
                            } else {
                                $('#bofqi').find('#loading-notice').text('调用 Bilibili Mac 客户端失败 :(');
                            }
                        });
                    },
                };
                if (biliHelper.helperBlock) {
                    biliHelper.helperBlock.remove();
                }
                if (biliHelper.site === 0) {
                    // old standard player page
                    biliHelper.helperBlock = $('<div class="block bili-helper" id="bilibili_helper"><span class="t"><div class="icon"></div><div class="t-right"><span class="t-right-top middle">助手</span><span class="t-right-bottom">扩展菜单</span></div></span><div class="info"><div class="main"></div><div class="version" title="' + biliHelper.version + '">哔哩哔哩助手 by <a href="http://weibo.com/guguke" target="_blank">@啾咕咕</a> <a href="http://weibo.com/ruo0037" target="_blank">@肉肉</a><a class="setting b-btn w" href="' + chrome.extension.getURL('options.html') + '" target="_blank">设置</a></div></div></div>');
                    biliHelper.helperBlock.find('.t').click(function() {
                        biliHelper.helperBlock.toggleClass('active');
                    });
                } else if (biliHelper.site === 1) {
                    // old bangumi page
                    biliHelper.helperBlock = $('<span class="bili-helper"><div class="v1-bangumi-info-btn" id="bilibili_helper">哔哩哔哩助手</div><div class="info"><div class="main"></div><div class="version" title="' + biliHelper.version + '">哔哩哔哩助手 by <a href="http://weibo.com/guguke" target="_blank">@啾咕咕</a> <a href="http://weibo.com/ruo0037" target="_blank">@肉肉</a><a class="setting b-btn w" href="' + chrome.extension.getURL('options.html') + '" target="_blank">设置</a></div></div></span>');
                    biliHelper.helperBlock.find('.v1-bangumi-info-btn').click(function() {
                        biliHelper.helperBlock.toggleClass('active');
                    });
                } else if (biliHelper.site === 3) {
                    // new bangumi page
                    biliHelper.helperBlock = $('<span class="bili-helper"><li class="share-btn btn-bilihelper" id="bilibili_helper">哔哩哔哩助手</li><div class="info"><div class="main"></div><div class="version" title="' + biliHelper.version + '">哔哩哔哩助手 by <a href="http://weibo.com/guguke" target="_blank">@啾咕咕</a> <a href="http://weibo.com/ruo0037" target="_blank">@肉肉</a><a class="setting b-btn w" href="' + chrome.extension.getURL('options.html') + '" target="_blank">设置</a></div></div></span>');
                    biliHelper.helperBlock.find('.btn-bilihelper').click(function() {
                        biliHelper.helperBlock.toggleClass('active');
                    });
                } else if (biliHelper.site === 4) {
                    // new standard player page
                    biliHelper.helperBlock = $('<div class="block bili-helper" id="bilibili_helper"><div class="icon-move"></div><div class="btn-item"><span class="t">助手</span><span class="num">菜单</span></div><div class="info"><div class="main"></div><div class="version" title="' + biliHelper.version + '">哔哩哔哩助手 by <a href="http://weibo.com/guguke" target="_blank">@啾咕咕</a> <a href="http://weibo.com/ruo0037" target="_blank">@肉肉</a><a class="setting b-btn w" href="' + chrome.extension.getURL('options.html') + '" target="_blank">设置</a></div></div></div>');
                    biliHelper.helperBlock.find('.btn-item').click(function() {
                        biliHelper.helperBlock.toggleClass('active');
                    });
                }
                let blockInfo = biliHelper.helperBlock.find('.info');
                biliHelper.mainBlock = blockInfo.find('.main');
                biliHelper.mainBlock.infoSection = $('<div class="section video hidden"><h3>视频信息</h3><p><span></span><span>aid: ' + biliHelper.avid + '</span><span>pg: ' + biliHelper.page + '</span></p></div>');
                biliHelper.mainBlock.append(biliHelper.mainBlock.infoSection);
                biliHelper.mainBlock.dblclick(function(e) {
                    if (e.shiftKey) {
                        biliHelper.mainBlock.infoSection.toggleClass('hidden');
                    }
                });
                // if (biliHelper.redirectUrl && biliHelper.redirectUrl !== "undefined") {
                //   biliHelper.mainBlock.redirectSection = $('<div class="section redirect"><h3>生成页选项</h3><p><a class="b-btn w" href="' + biliHelper.redirectUrl + '">前往原始跳转页</a></p></div>');
                //   biliHelper.mainBlock.append(biliHelper.mainBlock.redirectSection);
                // }
                // if (biliHelper.redirectUrl) {
                //   biliHelper.mainBlock.switcherSection.find('a[type="original"]').addClass('hidden');
                //   biliHelper.mainBlock.switcherSection.find('a[type="swf"],a[type="iframe"]').removeClass('hidden');
                // }
                if (localStorage.getItem('bilimac_player_type')) {
                    biliHelper.mainBlock.switcherSection = $('<div class="section switcher"><h3>播放器切换</h3><p></p></div>');
                    biliHelper.mainBlock.switcherSection.find('p').append($('<a class="b-btn w" type="original">原始播放器</a><a class="b-btn w" type="bilimac">Mac 客户端</a>').click(function() {
                        biliHelper.switcher[$(this).attr('type')]();
                    }));
                    biliHelper.mainBlock.append(biliHelper.mainBlock.switcherSection);
                }
                biliHelper.mainBlock.downloaderSection = $('<div class="section downloder"><h3>视频下载</h3><p><span></span>视频地址获取中，请稍等…</p></div>');
                biliHelper.mainBlock.append(biliHelper.mainBlock.downloaderSection);
                biliHelper.mainBlock.querySection = $('<div class="section query"><h3>弹幕发送者查询</h3><p><span></span>正在加载全部弹幕, 请稍等…</p></div>');
                biliHelper.mainBlock.append(biliHelper.mainBlock.querySection);

                biliHelper.switcher.set('original');
                setWide(response.autowide);
                $('[name=tab_danmulist]').click(); // 默认从视频推荐切换到弹幕列表
                if (biliHelper.site === 0) {
                    $('.block.app').after(biliHelper.helperBlock);
                } else if (biliHelper.site === 1) {
                    $('.v1-bangumi-info-operate .v1-app-btn').after(biliHelper.helperBlock);
                } else if (biliHelper.site === 3) {
                    $('.bangumi-info .func-module').prepend(biliHelper.helperBlock);
                } else if (biliHelper.site === 4) {
                    let observer = new MutationObserver(function() {
                        if ($('#playpage_mobileshow').length > 0) {
                            $('#playpage_mobileshow').after(biliHelper.helperBlock);
                            observer.disconnect();
                        }
                    });
                    observer.observe($('.player-box')[0], {
                        childList: true,
                        attributes: true,
                        subtree: true,
                        attributeFilter: ['src'],
                    });
                }
                $(document).ready(biliHelperFunc);
                initStyle();
            });
        });
    };

    if (typeof $ === 'function' && $('.player-wrapper .v-plist').length) {
        let prob = document.createElement('script');
        prob.id = 'page-prob';
        prob.innerHTML = '$(\'.player-wrapper .v-plist\').attr(\'length\', window.VideoPart.nodedata.length);$(\'#page-prob\').remove();';
        document.body.appendChild(prob);
    }
    $('html').addClass('bilibili-helper');
    window.addEventListener('message', (e) => {
        if (e.source !== window) {
            return;
        }
        if (e.data.key === 'initState') {
            if (e.data.value.epInfo) {
                let epInfo = e.data.value.epInfo;
                let isSameVideo = true;
                if (epInfo.aid) {
                    isSameVideo &= biliHelper.avid === epInfo.aid;
                    biliHelper.avid = epInfo.aid;
                }
                if (epInfo.cid) {
                    isSameVideo &= biliHelper.cid === epInfo.cid;
                    biliHelper.cid = epInfo.cid;
                }
                if (epInfo.page) {
                    isSameVideo &= biliHelper.page === epInfo.page;
                    biliHelper.page = epInfo.page;
                }
                if (!isSameVideo) {
                    initHelper();
                }
            } else if (e.data.value.videoData) {
                const videoData = e.data.value.videoData;
                biliHelper.avid = videoData.aid;
                biliHelper.page = videoData.videos;
                biliHelper.cid = videoData.pages[biliHelper.page - 1].cid;
            }
        }
    });
    let bili_reg, urlResult, uriPage;
    if (biliHelper.site === 0 || biliHelper.site === 4) {
        bili_reg = /\/video\/av([0-9]+)(?:\/)?(?:index_([0-9]+)\.html)?.*?$/;
        urlResult = bili_reg.exec(document.location.pathname);
        uriPage = biliHelper.site === 0 ?
            (/page=([0-9]+)/).exec(document.location.hash) :
            (/p=([0-9]+)/).exec(document.location.search);
        if (uriPage && typeof uriPage === 'object' && !isNaN(uriPage[1])) {
            uriPage = parseInt(uriPage[1]);
        }
        if (urlResult) {
            biliHelper.avid = urlResult[1];
            biliHelper.page = uriPage || urlResult[2];
        }
        const prob = document.createElement('script');
        prob.id = 'init-state-prob';
        prob.innerHTML = 'window.postMessage({key: \'initState\', value: window.__INITIAL_STATE__}, \'*\');';
        document.body.appendChild(prob);
        if (biliHelper.avid) {
            initHelper();
        }
        let playerBlock = $('#bofqi')[0];
        let observer = new MutationObserver(function() {
            let uriPage = (/p=([0-9]+)/).exec(document.location.search);
            if (uriPage && typeof uriPage === 'object' && !isNaN(uriPage[1])) {
                uriPage = parseInt(uriPage[1]);
            }
            if (uriPage && uriPage !== biliHelper.page) {
                biliHelper.page = uriPage;
                biliHelper.cid = undefined;
                initHelper();
            }
        });
        if (playerBlock) {
            observer.observe(playerBlock, {
                childList: true,
                attributes: true,
                subtree: true,
                attributeFilter: ['src'],
            });
        }
    } else if (biliHelper.site === 1 || biliHelper.site === 3) {
        let playerBlock = $('#bofqi')[0];
        if (playerBlock) {
            let observer = new MutationObserver(function() {
                if ($('#bofqi object param[name="flashvars"]').length || $('iframe.player').length) {
                    urlResult = $('#bofqi object param[name="flashvars"]').attr('value') || $('iframe.player').attr('src');
                    if (urlResult) {
                        let search = urlResult.split('&').map(function(searchPart) {
                            return searchPart.split('=', 2);
                        });
                        let isSameVideo = true;
                        search.forEach(function(param) {
                            let key = param[0],
                                value = param[1];
                            if (key === 'aid') {
                                isSameVideo &= biliHelper.avid === value;
                                biliHelper.avid = value;
                            } else if (key === 'cid') {
                                isSameVideo &= biliHelper.cid === value;
                                biliHelper.cid = value;
                            } else if (key === 'page') {
                                isSameVideo &= biliHelper.page === value;
                                biliHelper.page = value;
                            }
                        });
                        if (!isSameVideo) {
                            initHelper();
                        }
                    }
                } else {
                    let prob = document.createElement('script');
                    prob.id = 'init-state-prob';
                    prob.innerHTML = 'window.postMessage({key: \'initState\', value: window.__INITIAL_STATE__}, \'*\');$(\'#init-state-prob\').remove();';
                    document.body.appendChild(prob);
                }
            });
            if (playerBlock) {
                observer.observe(playerBlock, {
                    childList: true,
                    attributes: true,
                    subtree: true,
                    attributeFilter: ['src'],
                });
            }
            if ($('title')[0]) {
                observer.observe($('title')[0], {
                    childList: true,
                    attributes: true,
                    subtree: true,
                    attributeFilter: ['src'],
                });
            }
            document.addEventListener('loadstart', (e) => {
                if (biliHelper.removeAds) {
                    $('.bilibili-player.bilibili-player-ad video').prop('muted', true);
                    $('.bilibili-player.bilibili-player-ad').remove();
                }
            }, true);
        }
    } else if (biliHelper.site === 2) {
        chrome.runtime.sendMessage({
            command: 'init',
        }, function(response) {
            setWide(response.autowide);
        });
    }
    biliHelper.work = function() {
        chrome.runtime.sendMessage({
            command: 'getVideoInfo',
            avid: biliHelper.avid,
            pg: biliHelper.page + biliHelper.pageOffset,
        }, function(response) {
            let videoInfo = response.videoInfo;
            if (typeof videoInfo.cid === 'number' && $('.b-page-body .viewbox').length === 0 && $('.main-inner .viewbox').length === 0) {
                biliHelper.genPage = true;
                biliHelper.copyright = true;
            }
            biliHelper.videoPic = videoInfo.pic;
            setWide(biliHelper.autowide);
            if (biliHelper.autooffset === 'on') {
                setOffset();
            }

            if (biliHelper.closeDanmaku) {
                let danmaku_switch = $('.bilibili-player-video-danmaku-switch input[type=checkbox]')[0];
                // when button is available, click it
                if (danmaku_switch && danmaku_switch.checked) {
                    danmaku_switch.click();
                } else {
                    // or the page is old style, try click it
                    let old_switch = $('.bilibili-player-video-btn-danmaku')[0];
                    if (old_switch && !old_switch.classList.contains('video-state-danmaku-off')) {
                        old_switch.click();
                    }
                }
            }

            if (typeof videoInfo.code !== 'undefined' && videoInfo.code !== -404) {
                if (biliHelper.page !== 1) {
                    chrome.runtime.sendMessage({
                        command: 'getVideoInfo',
                        avid: biliHelper.avid,
                        pg: 1,
                        isBangumi: (biliHelper.site === 1),
                    }, function(response) {
                        let firstVideoInfo = response.videoInfo;
                        if (firstVideoInfo.pages === biliHelper.page - 1) {
                            biliHelper.pageOffset -= 1;
                            biliHelper.work();
                            return false;
                        }
                    });
                } else {
                    biliHelper.error = '错误' + videoInfo.code + ': ' + videoInfo.error;
                    biliHelper.mainBlock.errorSection = $('<div class="section error"><h3>Cid 获取失败</h3><p><span></span><span>' + parseSafe(biliHelper.error) + '</span></p></div>');
                    biliHelper.mainBlock.append(biliHelper.mainBlock.errorSection);
                    $('#loading-notice').fadeOut(300);
                }
            } else {
                // if (!isNaN(biliHelper.cid) && biliHelper.originalPlayer) {
                // biliHelper.originalPlayer.replace('cid=' + biliHelper.cid, 'cid=' + videoInfo.cid);
                // }
                if (biliHelper.cid === undefined) {
                    biliHelper.cid = videoInfo.cid;
                }
                if (biliHelper.site === 1) {
                    chrome.runtime.sendMessage({
                        command: 'getBangumiInfo',
                        episodeId: biliHelper.episodeId,
                    }, function(response) {
                        biliHelper.avid = response.videoInfo.avid;
                        biliHelper.cid = response.videoInfo.danmaku;
                        biliHelper.index = response.videoInfo.index;
                        createDanmuList();
                    });
                } else {
                    createDanmuList();
                }
            }

            function createDanmuList() {
                biliHelper.mainBlock.infoSection.find('p').append($('<span>cid: ' + biliHelper.cid + '</span>'));
                let commentDiv = $('<div class="section comment-list"><h3>弹幕下载</h3><p><a class="b-btn w" href="' + biliHelper.protocol + '//comment.bilibili.com/' + biliHelper.cid + '.xml">下载 XML 格式弹幕</a></p></div>');
                let url = biliHelper.protocol + '//comment.bilibili.com/' + biliHelper.cid + '.xml';
                let fileName = getNiceSectionFilename(biliHelper.avid, 1, 1);
                let downloadFileName = getDownloadOptions(url, fileName).filename;
                commentDiv.find('a').attr('download', downloadFileName).click(function(e) {
                    e.preventDefault();
                    if (biliHelper.xml_str) {
                        chrome.runtime.sendMessage({
                            command: 'requestForDownload',
                            data: biliHelper.xml_str,
                            filename: $(e.target).attr('download'),
                        });
                    } else {
                        chrome.runtime.sendMessage({
                            command: 'requestForDownload',
                            url: $(e.target).attr('href'),
                            filename: $(e.target).attr('download'),
                        });
                    }
                });
                biliHelper.mainBlock.commentSection = commentDiv;
                biliHelper.mainBlock.append(biliHelper.mainBlock.commentSection);
                fetch_(biliHelper.protocol + '//comment.bilibili.com/' + biliHelper.cid + '.xml?platform=bilihelper').then((res) => res.text()).then(function(text) {
                    biliHelper.xml_str = text;
                    let parser = new DOMParser();
                    let response = parser.parseFromString(
                        text.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/ug, ''), 'text/xml');
                    let assData = '\ufeff' + generateASS(setPosition(parseXML('', response)), {
                            'title': getNiceSectionFilename(biliHelper.avid, 1, 1),
                            'ori': location.href,
                        }),
                        assBlob = new Blob([assData], {
                            type: 'application/octet-stream',
                        }),
                        assUrl = window.URL.createObjectURL(assBlob),
                        assBtn = $('<a class="b-btn w">下载 ASS 格式弹幕</a>').attr('download', downloadFileName.replace('.xml', '.ass')).attr('href', assUrl).data('data', assData).click(function(e) {
                            e.preventDefault();
                            chrome.runtime.sendMessage({
                                command: 'requestForDownload',
                                data: $(e.target).data('data'),
                                url: $(e.target).attr('href'),
                                filename: $(e.target).attr('download'),
                            });
                        });
                    biliHelper.mainBlock.commentSection.find('p').append(assBtn);
                    biliHelper.comments = response.getElementsByTagName('d');
                    let control = $('<div><input type="text" class="b-input" placeholder="根据关键词筛选弹幕"><div class="b-slt"><span class="txt">请选择需要查询的弹幕…</span><ul class="list"><li disabled="disabled" class="disabled" selected="selected">请选择需要查询的弹幕</li></ul></div><span></span><span class="result">选择弹幕查看发送者…</span></div>');
                    control.find('.b-input').keyup(function() {
                        let keyword = control.find('input').val(),
                            regex = new RegExp(parseSafe(keyword), 'gi');
                        control.find('ul.list').html('<li disabled="disabled" class="disabled" selected="selected">请选择需要查询的弹幕</li>');
                        if (control.find('.b-slt .txt').text() !== '请选择需要查询的弹幕' && keyword.trim() !== '') {
                            control.find('.b-slt .txt').html(parseSafe(control.find('.b-slt .txt').text()));
                        }
                        if (keyword.trim() !== '') {
                            control.find('.b-slt .txt').text(control.find('.b-slt .txt').text());
                        }
                        let list = control.find('ul.list');
                        for (let i = 0; i < biliHelper.comments.length; i++) {
                            let node = biliHelper.comments[i],
                                text = node.childNodes[0];
                            if (text && node && regex.test(text.nodeValue)) {
                                text = text.nodeValue;
                                let li = $('<li></li>');
                                let commentData = node.getAttribute('p').split(','),
                                    sender,
                                    time,
                                    originalContent;
                                if (biliHelper.comments[i].senderUsername === undefined) {
                                    sender = commentData[6];
                                    biliHelper.comments[i].senderUsername = sender;
                                } else {
                                    sender = biliHelper.comments[i].senderUsername;
                                }
                                if (biliHelper.comments[i].time === undefined) {
                                    time = parseTime(parseInt(commentData[0]) * 1000);
                                    biliHelper.comments[i].time = time;
                                } else {
                                    time = biliHelper.comments[i].time;
                                }
                                if (biliHelper.comments[i].originalContent === undefined) {
                                    originalContent = parseSafe(text);
                                    biliHelper.comments[i].originalContent = originalContent;
                                } else {
                                    originalContent = biliHelper.comments[i].originalContent;
                                }
                                let content = '[' + time + '] ';
                                // if (biliHelper.comments[i].senderId !== undefined) {
                                //     content += '<a href="' + biliHelper.protocol + '//space.bilibili.com/' + biliHelper.comments[i].senderId + '" target="_blank">' + biliHelper.comments[i].senderUsername + '</a>';
                                //     li.addClass('result');
                                // }
                                li.attr({
                                    'sender': sender,
                                    'index': i,
                                });
                                if (keyword.trim() === '') {
                                    content += originalContent;
                                } else {
                                    content += originalContent.replace(regex, function(kw) {
                                        return '<span class="kw">' + kw + '</span>';
                                    });
                                }
                                li.append(content).attr('title', originalContent);
                                if (node.error === true) {
                                    li.addClass('error');
                                }
                                list.append(li);
                            }
                        }
                        control.find('.b-slt .list li').on('click', (e) => {
                            $('.b-slt .list').hide();
                            if (biliHelper.selectedDanmu) {
                                biliHelper.selectedDanmu.removeClass('selected');
                            }
                            let item = $(e.target).closest('li');
                            biliHelper.selectedDanmu = item;
                            biliHelper.selectedDanmu.addClass('selected');
                            let sender = item.attr('sender'),
                                index = item.attr('index');
                            control.find('.result').text('查询中…');
                            if (sender.indexOf('D') === 0) {
                                control.find('.result').text('游客弹幕');
                                return;
                            }
                            let displayUserInfo = function(uid, data) {
                                biliHelper.comments[index].senderId = uid;
                                biliHelper.comments[index].senderUsername = parseSafe(data.name);
                                control.find('.result span a[data-usercard-mid="' + uid + '"]').text(data.name).after('<div target="_blank" class="user-info-level l' + parseSafe(data.level_info.current_level) + '"></div>');
                            };

                            let renderSender = function(uids) {
                                control.find('.result').html('发送者: <span></span>');
                                for (let uid of uids) {
                                    control.find('.result span').append('<a href="' + biliHelper.protocol + '//space.bilibili.com/' + uid + '" target="_blank" data-usercard-mid="' + uid + '">UID: ' + uid + '</a><br/>');
                                    let cachedData = sessionStorage.getItem('user/' + uid);
                                    if (cachedData) {
                                        displayUserInfo(uid, JSON.parse(cachedData));
                                    } else {
                                        $.getJSON(biliHelper.protocol + '//api.bilibili.com/x/web-interface/card?mid=' + uid + '&type=json', function(data) {
                                            if (data.code === 0 && data.data && data.data.card && !!data.data.card.mid) {
                                                let cardData = data.data.card;
                                                sessionStorage.setItem('user/' + uid, JSON.stringify({
                                                    name: cardData.name,
                                                    level_info: {
                                                        current_level: cardData.level_info.current_level,
                                                    },
                                                }));
                                                displayUserInfo(uid, cardData);
                                            } else if (data.code === -626 || !data.data.card.mid) {
                                                control.find('.result span a[data-usercard-mid="' + uid + '"],.result span a[data-usercard-mid="' + uid + '"]+br').remove();
                                            }
                                        });
                                    }
                                }
                            };

                            let extracted = /^b(\d+)$/.exec(sender);
                            if (extracted) {
                                renderSender(extracted[1]);
                            } else {
                                chrome.runtime.sendMessage({
                                    command: 'uidLookup',
                                    user: sender,
                                }, function(result) {
                                    if (result.uids.length < 0) {
                                        control.find('.result').text('查询失败.');
                                        item.addClass('error');
                                        biliHelper.comments[index].error = true;
                                    } else {
                                        renderSender(result.uids);
                                    }
                                });
                            }
                        });
                    });
                    control.find('.b-input').keyup();
                    control.find('.b-slt').on('mouseover', () => {
                        $('.b-slt .list').show();
                    }).on('mouseleave', () => {
                        $('.b-slt .list').hide();
                    });
                    biliHelper.mainBlock.querySection.find('p').empty().append(control);
                });
            }
            let c = null;

            window.postMessage ? (c = function(a) {
                'https://secure.bilibili.com' !== a.origin && 'https://ssl.bilibili.com' !== a.origin || 'secJS:' !== a.data.substr(0, 6) || biliHelper.eval(a.data.substr(6));
            }, window.addEventListener ? window.addEventListener('message', c, !1) : window.attachEvent && window.attachEvent('onmessage', c)) : setInterval(function() {
                let evalCode = window.__GetCookie('__secureJS');
                window.__SetCookie('__secureJS', '');
                biliHelper.eval(evalCode);
            }, 1000);

            if (!biliHelper.cid) {
                biliHelper.error = '错误' + videoInfo.code + ': ' + videoInfo.error;
                biliHelper.mainBlock.errorSection = $('<div class="section error"><h3>Cid 获取失败</h3><p><span></span><span>' + parseSafe(biliHelper.error) + '</span></p></div>');
                biliHelper.mainBlock.append(biliHelper.mainBlock.errorSection);
                return false;
            }

            finishUp();
        });
    };
    let biliHelperFunc = function() {
        if (localStorage.getItem('bilimac_player_type') === 'force') {
            biliHelper.switcher.set('bilimac');
        }
        localStorage.removeItem('bilimac_player_type');
        biliHelper.replacePlayer = false;
        biliHelper.work();
    };

    function getNiceSectionFilename(avid, idx, numParts) {
        // TODO inspect the page to get better section name
        let idName = 'av' + avid + '_';
        // page/part name is only shown when there are more than one pages/parts
        let pageIdName = '';
        let partIdName = (numParts && (numParts > 1)) ? ('' + idx + '_') : '';

        // try to find a good page name
        let pageName = $('.player-wrapper #plist > span').text();
        pageName = pageName.substr(pageName.indexOf('、') + 1) + '_';
        // document.title contains other info feeling too much
        return idName + pageIdName + pageName + partIdName + (
            $('div.v-title').text() ||
            $('.video-info-m h1').attr('title') ||
            $('.bangumi-header .header-info h1').text()).trim();
    }

    // Helper function, return object {url, filename}, options object used by
    // "chrome.downloads.download"
    function getDownloadOptions(url, filename) {
        // TODO Improve file extension determination process.
        //
        // Parsing the url should be ok in most cases, but the best way should
        // use MIME types and tentative file names returned by server. Not
        // feasible at this stage.
        let resFn = null,
            fileBaseName = url.split('://').pop().split('?')[0],
            // arbitrarily default to "mp4" for no better reason...
            fileExt = fileBaseName.match(/[.]/) ? fileBaseName.match(/[^.]+$/) : 'mp4';

        // file extension auto conversion.
        //
        // Some sources are known to give weird file extensions, do our best to
        // convert them.
        switch (fileExt) {
        case 'letv':
            fileExt = 'flv';
            break;
        default:
                // remain the same, nothing
            break;
        }

        resFn = filenameSanitize(filename, {
            replacement: '_',
            max: 255 - fileExt.length - 1,
        }) + '.' + fileExt;

        return {
            'url': url,
            'filename': resFn,
        };
    }
})();
