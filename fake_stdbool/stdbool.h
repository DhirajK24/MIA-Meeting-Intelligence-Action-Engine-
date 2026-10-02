#ifndef _FAKE_STDBOOL_H
#define _FAKE_STDBOOL_H

#ifndef __cplusplus
#define bool _Bool
#define true 1
#define false 0
#else
/* C++ has built-in bool */
#endif

#define __bool_true_false_are_defined 1

#endif
