---
title: 莫比乌斯反演前置知识
date: 2019-06-7 14:15:00
tags:
 - 数论
 - 莫比乌斯反演
categories:
 - OI
author: Doubleen
avatar: https://cdn.luogu.com.cn/upload/usericon/56432.png
authorLink: https://doubleen233.github.io
authorAbout: 菜
authorDesc: 菜
description: 莫比乌斯反演前置知识
photos: http://api.mtyqx.cn/api/random.php
mathjax: true
---

# 莫比乌斯反演前置知识

学习参考：

https://acfcacfca.blog.luogu.org/dls-tql

https://www.cnblogs.com/peng-ym/p/8647856.html

https://www.cnblogs.com/gzy-cjoier/p/9686787.html

## 函数知识

完全积性函数 
$$\epsilon(n) = [n=1], I(n) = 1, id(n) = n$$

积性函数：对于任意互质的整数 $a,b$ 有 $f(ab)=f(a)f(b)$ 则称 $f(x)$ 的数论函数。

完全积性函数：对于任意整数 $a,b$ 有 $f(ab)=f(a)f(b)$ 的数论函数。

## 狄利克雷卷积

含义：$(f*g)(n)=\sum_{d|n}^{}f(d)g(\frac{d}{n})$

单位元： $\epsilon$ （即 $f*\epsilon=f$ ）

$$μ*I=ϵ $$

$$\varphi * I = id$$

$$\mu * id = \varphi$$

## 莫比乌斯函数定义和性质：

### 定义：

1.当 $d=1$ 时，$μ(d)=1$

2.当$d=\prod_{i=1}^k pi$且$pi$为互异素数时$\mu(d)$ = $(-1)^k$ 

3.只要当$d$含有任何质因子的幂次大于等于$2$，则函数值为$0$

### 性质：

1.$\sum_{d|n}\frac{\mu(d)}{d}=\frac{\phi(n)}{n}$

2.$\sum_{d|n}\mu(d)=[n=1]$
